import {Vector3} from 'three';
import {PolyScene} from '../../engine/scene/PolyScene';
import {Number3} from '../../types/GlobalTypes';
import {SoftBody} from './SoftBody';

// const gPhysicsScene = {
// 	gravity: [0.0, -10.0, 0.0],
// 	// dt: 1.0 / 60.0,
// 	// numSubsteps: 10,
// 	// paused: true,
// 	// objects: [],
// };
interface SoftBodyControllerOptions {
	// subSteps: number;
	gravity: Vector3;
}

export class SoftBodyController {
	private _stepsCount: number = 10;
	private _softBodies: SoftBody[] = [];
	private _gravity: Number3;
	constructor(public readonly scene: PolyScene, options: SoftBodyControllerOptions) {
		this._gravity = options.gravity.toArray();
		// this._stepsCount = options.subSteps;
		// console.log('create subSteps:', options.subSteps, this._stepsCount);
		this._softBodies.length = 0;
	}
	// init() {
	// 	const body = new SoftBody(bunnyMesh, gThreeScene);
	// 	gPhysicsScene.objects.push(body);
	// 	document.getElementById('numTets').innerHTML = body.numTets;
	// }
	setSubSteps(subSteps: number) {
		this._stepsCount = subSteps;
	}
	addSoftBody(softBody: SoftBody) {
		this._softBodies.push(softBody);
	}
	clearSoftBodies() {
		this._softBodies.length = 0;
	}
	step() {
		const delta = this.scene.timeController.delta();
		// if (gPhysicsScene.paused) return;
		const stepsCount = this._stepsCount;

		const sdt = delta / stepsCount;
		const softBodies = this._softBodies;

		for (let step = 0; step < stepsCount; step++) {
			for (const softBody of softBodies) {
				softBody.preSolve(sdt, this._gravity);
			}

			for (const softBody of softBodies) {
				softBody.solve(sdt);
			}

			for (const softBody of softBodies) {
				softBody.postSolve(sdt);
			}
		}

		// gGrabber.increaseTime(gPhysicsScene.dt);
	}
}