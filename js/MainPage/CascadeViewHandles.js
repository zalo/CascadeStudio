// This file handles Transformation Gizmos
import * as THREE from 'three';
import { TransformControls } from '../../node_modules/three/examples/jsm/controls/TransformControls.js';

/** Manages Transform Gizmo handles in the 3D viewport. */
class HandleManager {
  constructor(viewport, messageBus) {
    this.viewport = viewport;

    // Register the message handler for creating transform handles
    messageBus.on("createTransformHandle", this.createTransformHandle.bind(this));

    // Listen for keyboard shortcuts to change gizmo mode
    this._setupKeyboardShortcuts();
  }

  /** Create a Transformation Gizmo in the Scene View. */
  createTransformHandle(payload) {
    if (payload.lineAndColumn[0] <= 0) {
      console.error("Transform Gizmo not supported in this browser!  Use Chrome or Firefox!");
      return null;
    }

    let handle = new TransformControls(
      this.viewport.environment.camera,
      this.viewport.environment.renderer.domElement
    );
    handle.setTranslationSnap(1);
    handle.setRotationSnap(THREE.MathUtils.degToRad(1));
    handle.setScaleSnap(0.05);
    handle.setMode(this.viewport.gizmoMode);
    handle.setSpace(this.viewport.gizmoSpace);
    handle.lineAndColumn = payload.lineAndColumn;

    handle.onChanged = (event) => {
      this.viewport.environment.controls.enabled = !event.value;
      this.viewport.environment.viewDirty = true;

      // Inject transform data back into the editor upon completion
      if (this.viewport.environment.controls.enabled) {
        let code = window.monacoEditor.getValue().split("\n");
        let lineNum = handle.lineAndColumn[0] - 1;

        let translateString = "[" +
          handle.placeHolder.position.x.toFixed() + ", " +
          -handle.placeHolder.position.z.toFixed() + ", " +
          handle.placeHolder.position.y.toFixed() + "]";
        let axisAngle = [[0, 0, 0], 0];
        let q = handle.placeHolder.quaternion;
        if ((1 - (q.w * q.w)) > 0.001) {
          axisAngle = [[
            q.x / Math.sqrt(1 - q.w * q.w),
            -q.z / Math.sqrt(1 - q.w * q.w),
            q.y / Math.sqrt(1 - q.w * q.w),
          ], 2 * Math.acos(q.w) * 57.2958];
        }
        let rotateString = "[[" +
          axisAngle[0][0].toFixed(2) + ", " +
          axisAngle[0][1].toFixed(2) + ", " +
          axisAngle[0][2].toFixed(2) + "], " +
          axisAngle[1].toFixed(2) + "]";
        let scaleString = handle.placeHolder.scale.x.toFixed(2);
        let updateString = "Transform(" + translateString + ", " + rotateString + ", " + scaleString + ",";

        let fullSwapped = code[lineNum]
          .replace(/(Transform\(\[(.*?)\]\,\s*\[\[(.*?)\,(.*?)\,(.*?)\]\,(.*?)]\, (.*?)\,)/, updateString);
        if (!code[lineNum].includes(updateString)) {
          if (fullSwapped === code[lineNum]) {
            code[lineNum] = code[lineNum]
              .replace(/(Transform\()/g, updateString + " ");
          } else {
            code[lineNum] = fullSwapped;
          }

          let newCode = "";
          code.forEach((codeLine) => { newCode += codeLine + "\n"; });
          window.monacoEditor.setValue(newCode.slice(0, -1));
          window.monacoEditor.evaluateCode(false);
        }
      }
    };
    handle.addEventListener('dragging-changed', handle.onChanged);

    // Create a fake object for the handle to attach to
    let emptyObject = new THREE.Group();
    emptyObject.position.set(payload.translation[0], payload.translation[2], -payload.translation[1]);
    emptyObject.setRotationFromAxisAngle(
      new THREE.Vector3(payload.rotation[0][0], payload.rotation[0][2], -payload.rotation[0][1]),
      payload.rotation[1] * 0.0174533
    );
    emptyObject.scale.set(payload.scale, payload.scale, payload.scale);
    this.viewport.environment.scene.add(emptyObject);
    handle.placeHolder = emptyObject;
    handle.attach(emptyObject);

    this.viewport.handles.push(handle);
    this.viewport.environment.scene.add(handle);
  }

  /** Clear all Transformation Gizmos from the scene. */
  clearTransformHandles() {
    this.viewport.handles.forEach((handle) => {
      handle.removeEventListener('dragging-changed', handle.onChanged);
      this.viewport.environment.scene.remove(handle.placeHolder);
      this.viewport.environment.scene.remove(handle);
    });
    this.viewport.handles = [];
  }

  /** Set up keyboard shortcuts for changing gizmo mode/space. */
  _setupKeyboardShortcuts() {
    window.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'KeyX':
          this.viewport.gizmoSpace = (this.viewport.gizmoSpace === "local") ? "world" : "local";
          this.viewport.handles.forEach((handle) => { handle.setSpace(this.viewport.gizmoSpace); });
          break;
        case 'KeyW':
          this.viewport.gizmoMode = "translate";
          this.viewport.handles.forEach((handle) => { handle.setMode(this.viewport.gizmoMode); });
          break;
        case 'KeyE':
          this.viewport.gizmoMode = "rotate";
          this.viewport.handles.forEach((handle) => { handle.setMode(this.viewport.gizmoMode); });
          break;
        case 'KeyR':
          this.viewport.gizmoMode = "scale";
          this.viewport.handles.forEach((handle) => { handle.setMode(this.viewport.gizmoMode); });
          break;
      }
      this.viewport.environment.viewDirty = true;
    });
  }
}

export { HandleManager };
