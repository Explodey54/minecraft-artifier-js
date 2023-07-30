import SchematicsHelper from "../models/schematics.js";
const _URL = window.URL || window.webkitURL;

const store = {
  parent: null,
  init(parent) {
    this.parent = parent;
    const nodeList = document
      .querySelectorAll('*[id^="start-"]')
      .forEach((item) => {
        let key = "$";
        item.id.split("-").forEach((str, i) => {
          if (i > 1) {
            key += str.charAt(0).toUpperCase() + str.slice(1);
          } else if (i > 0) {
            key += str;
          }
        });
        this[key] = item;
      });
    this.setEventListeners();
  },
  changeToSettingsScreen() {
    document.querySelector("section.start-screen").classList.add("hidden");
    document
      .querySelector("section.settings-screen")
      .classList.remove("hidden");
  },
  changeToEditorScreen() {
    if (store.parent.uploadedType === "schem") {
      store.parent.editorScreen.$settingsOriginal.parentNode.setAttribute(
        "disabled",
        ""
      );
      store.parent.editorScreen.$settingsOriginal.disabled = true;
    } else {
      store.parent.editorScreen.$settingsOriginal.parentNode.removeAttribute(
        "disabled"
      );
      store.parent.editorScreen.$settingsOriginal.disabled = false;
    }
    document.querySelector("section.start-screen").classList.add("hidden");
    document.querySelector("section.editor-screen").classList.remove("hidden");
    store.parent.editorScreen.resetScreen();
    store.parent.convertScreen.resetScreen();
  },
  setNameFile(str) {
    store.parent.uploadedImageName = str;
    store.parent.editorScreen.$saveInput.value = str;
    store.parent.convertScreen.$inputMcfunction.value = str;
  },
  uploadImage(src) {
    store.parent.uploadedType = "image";
    store.parent.uploadedImage.src = src;
    store.parent.uploadedImage.onload = () => {
      store.parent.settingsScreen.$imgPresentation.src = src;
      store.parent.settingsScreen.$inputWidth.value =
        store.parent.uploadedImage.width;
      store.parent.settingsScreen.$inputHeight.value =
        store.parent.uploadedImage.height;
      store.parent.settingsScreen.aspectRatio =
        store.parent.uploadedImage.width / store.parent.uploadedImage.height;
      store.parent.settingsScreen.setImageSizesString(
        store.parent.uploadedImage.naturalWidth,
        store.parent.uploadedImage.naturalHeight
      );
      store.parent.settingsScreen.setEqualsString();
      store.parent.settingsScreen.fillTable();
      this.changeToSettingsScreen();
      store.parent.settingsScreen.svgCroppy.init(
        store.parent.settingsScreen.$imgPresentation
      );
      store.parent.settingsScreen.svgCroppy.hide();
      if (
        store.parent.uploadedImage.naturalWidth < 100 ||
        store.parent.uploadedImage.naturalHeight < 100
      ) {
        store.parent.settingsScreen.$checkCrop.disabled = true;
        store.parent.settingsScreen.$checkCrop.parentNode.setAttribute(
          "disabled",
          ""
        );
      } else {
        store.parent.settingsScreen.$checkCrop.disabled = false;
        store.parent.settingsScreen.$checkCrop.parentNode.removeAttribute(
          "disabled"
        );
      }
    };
  },
  uploadSchematic(file) {
    store.parent.showLoading();
    const errFunc = (str, timeout) => {
      store.parent.errors.triggerError("start-screen", str, 7200);
      store.parent.errors.triggerError("editor-screen", str, 7200);
      store.parent.hideLoading();
    };
    const schem = new SchematicsHelper();
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = function (event) {
      try {
        schem.decode(new Uint8Array(event.target.result), (err, data) => {
          try {
            if (err && err.code === "Z_DATA_ERROR") {
              errFunc(
                "There is something wrong with this .schematic file..<br>(File decompression error.)"
              );
              return;
            } else if (err) {
              errFunc(
                "There is something wrong with this .schematic file..<br>(Unknown error.)"
              );
              return;
            }

            const blockIds = new Uint8Array(data.value["Blocks"].value);
            const dataIds = new Uint8Array(data.value["Data"].value);
            const arr = new Uint8Array(blockIds.length);
            const height = data.value["Height"].value;
            let width, facing;
            if (
              data.value["WEOffsetX"] &&
              data.value["WEOffsetY"] &&
              data.value["WEOffsetZ"]
            ) {
              if (data.value["Width"].value === 1) {
                width = data.value["Length"].value;
                if (data.value["WEOffsetZ"].value > 0) {
                  facing = "south";
                } else {
                  facing = "north";
                }
              } else if (data.value["Length"].value === 1) {
                width = data.value["Width"].value;
                if (data.value["WEOffsetX"].value > 0) {
                  facing = "east";
                } else {
                  facing = "west";
                }
              } else if (
                data.value["Width"].value === 1 &&
                data.value["Length"].value === 1
              ) {
                width = data.value["Width"].value;
                facing = "north";
              } else {
                errFunc(
                  "There is something wrong with this .schematic file..<br>(Width or length of the schematic must equal 1.)"
                );
                return;
              }
            } else {
              if (data.value["Width"].value === 1) {
                width = data.value["Length"].value;
                facing = "north";
              } else if (data.value["Length"].value === 1) {
                width = data.value["Width"].value;
                facing = "west";
              } else if (
                data.value["Width"].value === 1 &&
                data.value["Length"].value === 1
              ) {
                width = data.value["Width"].value;
                facing = "north";
              } else {
                errFunc(
                  "There is something wrong with this .schematic file..<br>(Width or length of the schematic must equal 1.)"
                );
                return;
              }
            }

            for (let i = 0; i < arr.length; i++) {
              let int;
              if (facing === "south" || facing === "east") {
                int =
                  (height - Math.ceil((i + 1) / width)) * width + (i % width);
              } else if (facing === "north" || facing === "west") {
                int = arr.length - i - 1;
              }
              const block = store.parent.findBlockByGameId(
                blockIds[int],
                dataIds[int]
              );
              if (block) {
                arr[i] = block.id;
              }
            }
            store.parent.errors.closeError("start-screen");
            store.parent.errors.closeError("editor-screen");
            store.parent.uploadedType = "schem";
            store.parent.editorScreen.$footbarRight.innerHTML = `Width: <b>${width} bl.</b> | Height: <b>${height} bl.</b>`;
            store.changeToEditorScreen();
            store.parent.mineartCanvas.init(store.parent.editorScreen.$canvas);
            store.parent.mineartCanvas.setImageSizes(width, height);
            store.parent.mineartCanvas.open(arr);
            store.parent.editorScreen.resetScreen();
            store.parent.editorScreen.setBrushSize(3);
            store.parent.hideLoading();
          } catch (err) {
            console.error(err);
            errFunc(
              "There is something wrong with this .schematic file..<br>(File structure error.)"
            );
            return;
          }
        });
      } catch (err) {
        console.error(err);
        errFunc(
          "There is something wrong with this .schematic file..<br>(File structure error.)"
        );
        return;
      }
    };
  },
  setEventListeners() {
    this.$dropzone.ondragover = (e) => {
      e.preventDefault();
    };

    this.$dropzone.ondrop = (e) => {
      e.preventDefault();

      if (e.dataTransfer.files.length !== 1) {
        store.parent.errors.triggerError(
          "start-screen",
          "Please, choose only one file.",
          5000
        );
        return;
      }

      const regexp = /(.*)\.([^.]*)/;
      const output = e.dataTransfer.files[0].name.match(regexp);
      let ext, name;
      if (output) {
        ext = e.dataTransfer.files[0].name.match(regexp)[2];
        name = e.dataTransfer.files[0].name.match(regexp)[1];
      } else {
        store.parent.errors.triggerError(
          "start-screen",
          "Wrong file type. Try image (jpg, png, bmp) or .schematic file.",
          5000
        );
        return;
      }

      if (ext.match(/(jpeg|jpg|png|bmp)/i)) {
        this.setNameFile(name);
        this.uploadImage(_URL.createObjectURL(e.dataTransfer.files[0]));
      } else if (ext.match(/(schematic)/i)) {
        this.setNameFile(name);
        this.uploadSchematic(e.dataTransfer.files[0]);
      } else {
        store.parent.errors.triggerError(
          "start-screen",
          "Wrong file type. Try image (jpg, png, bmp) or .schematic file.",
          5000
        );
      }
    };

    this.$fileInput.onchange = (e) => {
      const regexp = /(.*)\.([^.]*)/;
      const output = e.target.files[0].name.match(regexp);
      let ext, name;

      if (output) {
        ext = e.target.files[0].name.match(regexp)[2];
        name = e.target.files[0].name.match(regexp)[1];
      } else {
        e.target.value = null;
        store.parent.errors.triggerError(
          "start-screen",
          "Wrong file type. Try image (jpg, png, bmp) or .schematic file.",
          5000
        );
        return;
      }

      if (ext.match(/(jpeg|jpg|png|bmp)/i)) {
        this.setNameFile(name);
        this.uploadImage(_URL.createObjectURL(e.target.files[0]));
      } else if (ext.match(/(schematic)/i)) {
        this.setNameFile(name);
        this.uploadSchematic(e.target.files[0]);
      } else {
        e.target.value = null;
        store.parent.errors.triggerError(
          "start-screen",
          "Wrong file type. Try image (jpg, png, bmp) or .schematic file.",
          5000
        );
      }
    };
  },
};

export { store as output };
