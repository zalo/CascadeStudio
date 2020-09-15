// This file handles Transformation Gizmos

/** Adds Handle Gizmo Functionality to the Cascade View */
function initializeHandleGizmos(threejsViewport){
  /** Create a Transformation Gizmo in the Scene View */
  messageHandlers["createTransformHandle"] = function (payload) {
    if (payload.lineAndColumn[0] <= 0) {
      console.error("Transform Gizmo not supported in this browser!  Use Chrome or Firefox!"); return null;
    }
    let handle = new THREE.TransformControls(this.environment.camera,
      this.environment.renderer.domElement);
    handle.setTranslationSnap(1);
    handle.setRotationSnap(THREE.MathUtils.degToRad(1));
    handle.setScaleSnap(0.05);
    handle.setMode(this.gizmoMode);
    handle.setSpace(this.gizmoSpace);
    handle.lineAndColumn = payload.lineAndColumn;
    handle.onChanged = (event) => {
      this.environment.controls.enabled = !event.value;
      this.environment.viewDirty = true;

      // Inject transform data back into the editor upon completion
      if (this.environment.controls.enabled) {
        let code = monacoEditor.getValue().split("\n");
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
        let scaleString = handle.placeHolder.scale.x.toFixed(2); // Use this properly later
        let updateString = "Transform(" + translateString + ", " + rotateString + ", " + scaleString + ",";

        let fullSwapped = code[lineNum]
          .replace(/(Transform\(\[(.*?)\]\,\s*\[\[(.*?)\,(.*?)\,(.*?)\]\,(.*?)]\, (.*?)\,)/, updateString);
        if (!code[lineNum].includes(updateString)) { // Only update if the transform has changed!
          if (fullSwapped === code[lineNum]) {
            code[lineNum] = code[lineNum]
              .replace(/(Transform\()/g, updateString + " "); // Initialize all the arguments
          } else {
            code[lineNum] = fullSwapped;
          }

          let newCode = "";
          code.forEach((codeLine) => { newCode += codeLine + "\n"; });
          monacoEditor.setValue(newCode.slice(0, -1));
          monacoEditor.evaluateCode(false);
        }
      }
    };
    handle.addEventListener('dragging-changed', handle.onChanged);

    // Create a fake object for the handle to attach to
    let emptyObject = new THREE.Group();
    emptyObject.position.set(payload.translation[0], payload.translation[2], -payload.translation[1]);
    emptyObject.setRotationFromAxisAngle(
      new THREE.Vector3(payload.rotation[0][0], payload.rotation[0][2], -payload.rotation[0][1]), payload.rotation[1] * 0.0174533);
    emptyObject.scale.set(payload.scale, payload.scale, payload.scale);
    this.environment.scene.add(emptyObject);
    handle.placeHolder = emptyObject;
    handle.attach(emptyObject);

    this.handles.push(handle);
    this.environment.scene.add(handle);
    //return handle;
  }.bind(threejsViewport);

  /** Clear the Transformation Gizmos in the Scene. */
  threejsViewport.clearTransformHandles = function () {
    this.handles.forEach((handle) => {
      handle.removeEventListener('dragging-changed', handle.onChanged);
      this.environment.scene.remove(handle.placeHolder);
      this.environment.scene.remove(handle);
    });
    this.handles = [];
  }.bind(threejsViewport);

  /** Change the Mode that the Transformation Gizmos are in. */
  window.addEventListener('keydown', function (event) {
    switch (event.keyCode) {
      // These match Unity's Hotkeys but I'm open to changing them
      case 88: // X
        this.gizmoSpace = (this.gizmoSpace === "local") ? "world" : "local";
        this.handles.forEach((handle) => { handle.setSpace(this.gizmoSpace); });
        break;
      case 87: // W
        this.gizmoMode = "translate";
        this.handles.forEach((handle) => {
          //handle.showX = true; handle.showY = true; handle.showZ = true;
          handle.setMode(this.gizmoMode);
        });
        break;
      case 69: // E
        this.gizmoMode = "rotate";
        this.handles.forEach((handle) => {
          //handle.showX = true; handle.showY = true; handle.showZ = true;
          handle.setMode(this.gizmoMode);
        });
        break;
      case 82: // R
        this.gizmoMode = "scale";
        this.handles.forEach((handle) => {
          //handle.showX = false; handle.showY = false; handle.showZ = false;
          handle.setMode(this.gizmoMode);
        });
        break;
    }
    this.environment.viewDirty = true;
  }.bind(threejsViewport));
}