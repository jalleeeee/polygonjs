import {TypedContainer} from "./_Base";
export class RopContainer extends TypedContainer {
  set_content(content) {
    super.set_content(content);
  }
  renderer() {
    return this._content;
  }
}