import {AttribValue, Number3, NumericAttribValue, PolyDictionary} from '../../../../types/GlobalTypes';
import {Box3, Color, Matrix4, Sphere, Vector2, Vector3, Vector4} from 'three';
import {Attribute, CoreAttribute} from '../../Attribute';
import {AttribType, AttribSize, ObjectData} from '../../Constant';
import {CoreEntity} from '../../CoreEntity';
import {CoreType} from '../../../Type';
import {SetUtils} from '../../../../core/SetUtils';
import {
	ObjectContent,
	CoreObjectType,
	ObjectGeometryMap,
	MergeCompactOptions,
	ObjectBuilder,
} from '../../ObjectContent';
import {TransformTargetType} from '../../../Transform';
import {ObjectTransformMode, ObjectTransformSpace} from '../../../TransformSpace';
import {EntityGroupCollection} from '../../EntityGroupCollection';
import {_updateObjectAttribRef} from '../../../reactivity/ObjectAttributeReactivityUpdateRef';
import {
	attribValueNonPrimitive,
	copyAttribValue,
	AttributeDictionary,
	cloneAttribValue,
} from '../../entities/object/BaseCoreObjectUtils';
import {getOrCreateObjectAttributeRef} from '../../../reactivity/ObjectAttributeReactivityCreateRef';
import {
	JsIConnectionPointTypeToDataTypeMap,
	ParamConvertibleJsType,
} from '../../../../engine/nodes/utils/io/connections/Js';
import {watch} from '../../../reactivity/CoreReactivity';
import {objectData} from './BaseCoreObjectUtils';

enum PropertyName {
	NAME = 'name',
	POSITION = 'position',
}
const ATTRIBUTES = 'attributes';
// const ATTRIBUTES_PREVIOUS_VALUES = 'attributesPreviousValues';

const ORIGIN = new Vector3(0, 0, 0);
function _convertArrayToVector(value: number[]) {
	switch (value.length) {
		case 1:
			return value[0];
		case 2:
			return new Vector2(value[0], value[1]);
		case 3:
			return new Vector3(value[0], value[1], value[2]);
		case 4:
			return new Vector4(value[0], value[1], value[2], value[3]);
	}
}
const tmpVec3 = new Vector3();
const tmpN3: Number3 = [0, 0, 0];

type OnAttribChange<T extends ParamConvertibleJsType> = (
	newValue: JsIConnectionPointTypeToDataTypeMap[T],
	oldValue: JsIConnectionPointTypeToDataTypeMap[T]
) => void;

export abstract class BaseCoreObject<T extends CoreObjectType> extends CoreEntity {
	protected _object: ObjectContent<T>;
	constructor(object: ObjectContent<T>, index: number) {
		super(object, index);
		this._object = object;
	}
	dispose() {}

	// set_index(i: number) {
	// 	this._index = i;
	// }

	object() {
		return this._object;
	}
	geometry(): ObjectGeometryMap[T] | null {
		return this._object?.geometry || null; //(this._object as Mesh).geometry as BufferGeometry | null;
	}
	builder<T extends CoreObjectType>(): ObjectBuilder<T> | undefined {
		return undefined;
	}
	static attributeRef<OT extends CoreObjectType, T extends ParamConvertibleJsType>(
		object: ObjectContent<OT>,
		attribName: string,
		type: T,
		defaultValue: JsIConnectionPointTypeToDataTypeMap[T]
	) {
		return getOrCreateObjectAttributeRef(object, attribName, type, defaultValue);
	}
	attributeRef<T extends ParamConvertibleJsType>(
		attribName: string,
		type: T,
		defaultValue: JsIConnectionPointTypeToDataTypeMap[T]
	) {
		if (!this._object) {
			return;
		}
		return (this.constructor as any as typeof BaseCoreObject<CoreObjectType>).attributeRef(
			this._object,
			attribName,
			type,
			defaultValue
		);
	}
	static onAttribChange<OT extends CoreObjectType, T extends ParamConvertibleJsType>(
		object: ObjectContent<OT>,
		attribName: string,
		type: T,
		defaultValue: JsIConnectionPointTypeToDataTypeMap[T],
		callback: OnAttribChange<T>
	) {
		const ref = this.attributeRef(object, attribName, type, defaultValue);
		return watch(ref.current, callback);
	}
	onAttribChange<T extends ParamConvertibleJsType>(
		attribName: string,
		type: T,
		defaultValue: JsIConnectionPointTypeToDataTypeMap[T],
		callback: OnAttribChange<T>
	) {
		if (!this._object) {
			return;
		}
		return (this.constructor as any as typeof BaseCoreObject<CoreObjectType>).onAttribChange(
			this._object,
			attribName,
			type,
			defaultValue,
			callback
		);
	}
	static setAttribute<T extends CoreObjectType>(object: ObjectContent<T>, attribName: string, value: AttribValue) {
		this.addAttribute(object, attribName, value);
	}
	static addAttribute<T extends CoreObjectType>(object: ObjectContent<T>, attribName: string, value: AttribValue) {
		if (CoreType.isArray(value)) {
			const convertedValue = _convertArrayToVector(value);
			if (!convertedValue) {
				const message = `value invalid`;
				console.error(message, value);
				throw new Error(message);
			}
		}

		const dict = this._attributesDictionary(object);

		const currentValue = dict[attribName];

		if (attribValueNonPrimitive(value)) {
			if (currentValue == null) {
				const cloned = cloneAttribValue(value);
				if (cloned) {
					dict[attribName] = cloned;
				}
			} else {
				if (attribValueNonPrimitive(currentValue)) {
					copyAttribValue(value, currentValue);
				}
			}
		} else {
			dict[attribName] = value;
		}
		_updateObjectAttribRef(object, attribName, value);
	}
	addAttribute(name: string, value: AttribValue) {
		if (!this._object) {
			return;
		}
		(this.constructor as any as typeof BaseCoreObject<CoreObjectType>).addAttribute(this._object, name, value);
	}
	addNumericAttrib(name: string, value: NumericAttribValue) {
		this.addAttribute(name, value);
	}
	setAttribValue(name: string, value: AttribValue) {
		this.addAttribute(name, value);
	}
	// addNumericVertexAttrib(name: string, size: number, defaultValue: NumericAttribValue) {
	// 	// if (defaultValue == null) {
	// 	// 	defaultValue = CoreAttribute.default_value(size);
	// 	// }
	// 	// this.coreGeometry()?.addNumericAttrib(name, size, defaultValue);
	// }
	protected static _attributesDictionary<T extends CoreObjectType>(object: ObjectContent<T>) {
		return (object.userData[ATTRIBUTES] as AttributeDictionary) || this._createAttributesDictionaryIfNone(object);
	}
	static attributesDictionaryEntry<T extends CoreObjectType>(
		object: ObjectContent<T>,
		attribName: string,
		defaultValue?: AttribValue
	) {
		const dict =
			(object.userData[ATTRIBUTES] as AttributeDictionary) || this._createAttributesDictionaryIfNone(object);
		let entry: AttribValue | undefined = dict[attribName];
		if (entry == null && defaultValue != null) {
			entry = defaultValue;
			dict[attribName] = entry;
		}
		return entry;
	}
	// static attributesPreviousValuesDictionary<T extends CoreObjectType>(object: ObjectContent<T>) {
	// 	return (
	// 		(object.userData[ATTRIBUTES_PREVIOUS_VALUES] as AttributeDictionary) ||
	// 		this._createAttributesPreviousValuesDictionaryIfNone(object)
	// 	);
	// }
	private static _createAttributesDictionaryIfNone<T extends CoreObjectType>(object: ObjectContent<T>) {
		if (!object.userData[ATTRIBUTES]) {
			return (object.userData[ATTRIBUTES] = {});
		}
	}
	// private static _createAttributesPreviousValuesDictionaryIfNone<T extends CoreObjectType>(object: ObjectContent<T>) {
	// 	if (!object.userData[ATTRIBUTES_PREVIOUS_VALUES]) {
	// 		return (object.userData[ATTRIBUTES_PREVIOUS_VALUES] = {});
	// 	}
	// }

	private _attributesDictionary() {
		return (this.constructor as typeof BaseCoreObject<CoreObjectType>)._attributesDictionary(this._object);
	}
	attributeNames(): string[] {
		return this.attribNames();
	}
	static attribNames<T extends CoreObjectType>(object: ObjectContent<T>): string[] {
		return Object.keys(this._attributesDictionary(object));
	}
	attribNames(): string[] {
		return (this.constructor as typeof BaseCoreObject<CoreObjectType>).attribNames(this._object);
	}
	static objectsAttribNames<T extends CoreObjectType>(objects: ObjectContent<T>[]) {
		const names: Set<string> = new Set();
		for (let object of objects) {
			const objectAttriNames = this.attribNames(object);
			for (let attribName of objectAttriNames) {
				names.add(attribName);
			}
		}

		return SetUtils.toArray(names);
	}

	hasAttrib(attribName: string): boolean {
		return (this.constructor as any as typeof BaseCoreObject<CoreObjectType>).hasAttrib(this._object, attribName);
	}
	static hasAttrib<T extends CoreObjectType>(object: ObjectContent<T>, attribName: string) {
		return attribName in this._attributesDictionary(object);
	}

	renameAttrib(oldName: string, newName: string) {
		return (this.constructor as any as typeof BaseCoreObject<CoreObjectType>).renameAttrib(
			this._object,
			oldName,
			newName
		);
	}
	static renameAttrib<T extends CoreObjectType>(object: ObjectContent<T>, oldName: string, newName: string) {
		const currentValue = this.attribValue(object, oldName);
		if (currentValue != null) {
			this.addAttribute(object, newName, currentValue);
			this.deleteAttribute(object, oldName);
		} else {
			console.warn(`attribute ${oldName} not found`);
		}
	}

	deleteAttribute(name: string) {
		delete this._attributesDictionary()[name];
	}
	static deleteAttribute<T extends CoreObjectType>(object: ObjectContent<T>, attribName: string) {
		delete this._attributesDictionary(object)[attribName];
	}
	// static position:PositionStaticMethod<CoreObjectType> = DEFAULT_POSITION_STATIC_METHOD
	static position(object: ObjectContent<CoreObjectType>, target: Vector3) {
		target.copy(ORIGIN);
	}
	position(target: Vector3) {
		(this.constructor as typeof BaseCoreObject<CoreObjectType>).position(this._object, target);
	}
	boundingBox(target: Box3) {
		target.makeEmpty();
	}
	geometryBoundingBox(target: Box3) {
		this.boundingBox(target);
	}
	boundingSphere(target: Sphere) {
		target.makeEmpty();
	}
	geometryBoundingSphere(target: Sphere) {
		this.boundingSphere(target);
	}
	static attribValue<T extends CoreObjectType>(
		object: ObjectContent<T>,
		attribName: string,
		index: number = 0,
		target?: Color | Vector2 | Vector3 | Vector4
	): AttribValue | undefined {
		const _attribFromProperty = () => {
			if (attribName == PropertyName.NAME) {
				return object.name;
			}
			if (attribName == PropertyName.POSITION) {
				const _target = target instanceof Vector3 ? target : tmpVec3;
				this.position(object, _target);
				_target.toArray(tmpN3);
				return tmpN3;
			}
		};
		if (attribName === Attribute.OBJECT_INDEX) {
			return index;
		}
		if (object.userData) {
			const val = this.attributesDictionaryEntry(object, attribName);
			// const val = attribRef.value; //dict[attribName];
			if (val == null) {
				return _attribFromProperty();
			} else {
				// const val = _ref.value;
				if (CoreType.isVector(val) && target) {
					if (val instanceof Vector2 && target instanceof Vector2) {
						return target.copy(val);
					}
					if (val instanceof Vector3 && target instanceof Vector3) {
						return target.copy(val);
					}
					if (val instanceof Vector4 && target instanceof Vector4) {
						return target.copy(val);
					}
				}
				if (CoreType.isColor(val) && target) {
					if (val instanceof Color && target instanceof Color) {
						return target.copy(val);
					}
				}
				if (CoreType.isArray(val) && target) {
					target.fromArray(val);
					return target;
				}
			}
			// console.log(attribName, _ref, _ref.value);
			return val; //_ref.value;
		}
		return _attribFromProperty();
	}
	// static previousAttribValue<T extends CoreObjectType>(
	// 	object: ObjectContent<T>,
	// 	attribName: string
	// ): AttribValue | undefined {
	// 	const dict = this.attributesPreviousValuesDictionary(object);
	// 	return dict[attribName];
	// }

	static stringAttribValue<T extends CoreObjectType>(
		object: ObjectContent<T>,
		attribName: string,
		index: number = 0
	): string | null {
		const str = this.attribValue(object, attribName, index);
		if (str != null) {
			if (CoreType.isString(str)) {
				return str;
			} else {
				return `${str}`;
			}
		}
		return null;
	}
	// static makeAttribReactive<V extends AttribValue, T extends CoreObjectType>(
	// 	object: ObjectContent<T>,
	// 	attribName: string,
	// 	callback: AttributeReactiveCallback<V>
	// ) {
	// 	const attributesDict = this.attributesDictionary(object);
	// 	// const attributesPreviousValuesDict = this.attributesPreviousValuesDictionary(object);

	// 	const currentValue = attributesDict[attribName];
	// 	if (currentValue instanceof Vector4) {
	// 		return makeAttribReactiveVector4(
	// 			object,
	// 			attribName,
	// 			(<unknown>callback) as AttributeReactiveCallback<Vector4>
	// 		);
	// 	}
	// 	if (currentValue instanceof Vector3) {
	// 		return makeAttribReactiveVector3(
	// 			object,
	// 			attribName,
	// 			(<unknown>callback) as AttributeReactiveCallback<Vector3>
	// 		);
	// 	}
	// 	if (currentValue instanceof Vector2) {
	// 		return makeAttribReactiveVector2(
	// 			object,
	// 			attribName,
	// 			(<unknown>callback) as AttributeReactiveCallback<Vector2>
	// 		);
	// 	}
	// 	return makeAttribReactiveSimple(
	// 		object,
	// 		attribName,
	// 		(<unknown>callback) as AttributeReactiveCallback<string | number>
	// 	);

	// 	// // create a dummy val in case there is no attribute yet
	// 	// if (attributesDict[attribName] == null) {
	// 	// 	attributesDict[attribName] = 0;
	// 	// }

	// 	// const proxy: AttributeProxy<V> = {
	// 	// 	value: attributesDict[attribName] as V,
	// 	// 	previousValue: attributesDict[attribName] as V,
	// 	// };
	// 	// Object.defineProperties(attributesDict, {
	// 	// 	[attribName]: {
	// 	// 		get: function () {
	// 	// 			return proxy.value;
	// 	// 		},
	// 	// 		set: function (x) {
	// 	// 			if (x != proxy.value) {
	// 	// 				proxy.previousValue = proxy.value;
	// 	// 				proxy.value = x;
	// 	// 				callback(proxy.value, proxy.previousValue);
	// 	// 			}
	// 	// 			return proxy.value;
	// 	// 		},
	// 	// 		configurable: true,
	// 	// 	},
	// 	// });
	// 	// Object.defineProperties(attributesPreviousValuesDict, {
	// 	// 	[attribName]: {
	// 	// 		get: function () {
	// 	// 			return proxy.previousValue;
	// 	// 		},
	// 	// 		configurable: true,
	// 	// 	},
	// 	// });
	// }

	attribValue(attribName: string, target?: Vector2 | Vector3 | Vector4): AttribValue | undefined {
		return (this.constructor as any as typeof BaseCoreObject<CoreObjectType>).attribValue(
			this._object,
			attribName,
			this._index,
			target
		);
	}
	stringAttribValue(name: string) {
		return (this.constructor as any as typeof BaseCoreObject<CoreObjectType>).stringAttribValue(
			this._object,
			name,
			this._index
		);
	}
	name(): string {
		return this.attribValue(PropertyName.NAME) as string;
	}
	humanType(): string {
		return this._object.type;
	}
	attribTypes() {
		const h: PolyDictionary<AttribType> = {};
		for (let attrib_name of this.attribNames()) {
			const type = this.attribType(attrib_name);
			if (type != null) {
				h[attrib_name] = type;
			}
		}
		return h;
	}
	static attribType<T extends CoreObjectType>(object: ObjectContent<T>, attribName: string) {
		const val = this.attribValue(object, attribName);
		if (CoreType.isString(val)) {
			return AttribType.STRING;
		} else {
			return AttribType.NUMERIC;
		}
	}
	attribType(attribName: string) {
		return (this.constructor as any as typeof BaseCoreObject<CoreObjectType>).attribType(this._object, attribName);
	}

	attribSizes() {
		const h: PolyDictionary<AttribSize> = {};
		const attribNames = this.attribNames();
		for (let attribName of attribNames) {
			const size = this.attribSize(attribName);
			if (size != null) {
				h[attribName] = size;
			}
		}
		return h;
	}
	static attribSize<T extends CoreObjectType>(object: ObjectContent<T>, attribName: string): AttribSize | null {
		const val = this.attribValue(object, attribName);
		if (val == null) {
			return null;
		}
		return CoreAttribute.attribSizeFromValue(val);
	}
	attribSize(attribName: string) {
		return (this.constructor as any as typeof BaseCoreObject<CoreObjectType>).attribSize(this._object, attribName);
	}

	static objectData<T extends CoreObjectType>(object: ObjectContent<T>): ObjectData {
		return objectData(object);
		// const childrenCount = isObject3D(object) ? object.children.length : 0;
		// // if ((object as Mesh).geometry) {
		// // 	points_count = CoreGeometry.pointsCount((object as Mesh).geometry as BufferGeometry);
		// // }
		// const objectType = isObject3D(object)
		// 	? objectTypeFromConstructor(object.constructor)
		// 	: (object.type as ObjectType);
		// const groupData = EntityGroupCollection.data(object);
		// return {
		// 	type: objectType,
		// 	name: object.name,
		// 	childrenCount,
		// 	groupData,
		// 	pointsCount: 0,
		// 	tetsCount: null,
		// };
	}

	clone(): BaseCoreObject<T> {
		const clonedObject = (this.constructor as typeof BaseCoreObject<CoreObjectType>).clone(this._object);
		const cloned = new (this.constructor as any)(clonedObject, this._index);
		return cloned;
	}

	static clone<T extends CoreObjectType>(srcObject: ObjectContent<T>): ObjectContent<T> {
		return srcObject.clone() as ObjectContent<T>;
	}

	static applyMatrix(
		object: ObjectContent<CoreObjectType>,
		matrix: Matrix4,
		transformTargetType: TransformTargetType,
		transformSpace: ObjectTransformSpace,
		transformMode: ObjectTransformMode
	) {
		console.warn('applyMatrix.override required', this);
	}
	static mergeCompact(options: MergeCompactOptions) {
		console.warn('mergeCompact.override required', this);
	}

	//
	//
	// ENTITY GROUPS
	//
	//
	groupCollection() {
		return new EntityGroupCollection(this._object);
	}

	//
	//
	// VERTICES
	//
	//
	// vertices() {
	// 	return verticesFromObject(this._object);
	// }

	// verticesFromGroup(group: GroupString): CoreVertex<T>[] {
	// 	return verticesFromObjectFromGroup(this._object, group);
	// }

	// //
	// //
	// // PRIMITIVES
	// //
	// //
	// primitives(): CorePrimitive<T>[] {
	// 	return primitivesFromObject(this._object);
	// }
	// primitivesFromGroup(group: GroupString): CorePrimitive<T>[] {
	// 	return primitivesFromObjectFromGroup(this._object, group);
	// }
}