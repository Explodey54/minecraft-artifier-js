// import './style.css'
import './style2.css'
import 'bulma/css/bulma.css'

import ConvertWorker from 'worker-loader!./models/convert.js'
import MineartCanvas from './models/canvas.js'

const blocks = require('../static/baked_blocks.json')
blocks.forEach((item) => {
    item.src = require('../static/textures/' + item.texture_image)
    delete item.texture_image
})

const store = {
    blocksDefault: blocks,
    convertWorker: new ConvertWorker(),
    mineartCanvas: new MineartCanvas(),
    canvasTemp: document.createElement('canvas'),
    localStorage: window.localStorage,
    uploadedType: null,
    uploadedImage: new Image(),
    uploadedImageName: null,
    minecraftVersion: 12,
    waitForLoaded: {
        arr: null,
        width: null,
        height: null
    },
    isSaved: true,
    findBlockById(id) {
        return this.blocksDefault.find((item) => {
            if (item.id === id) {
                return true
            }
        })
    },
    findBlockByGameId(blockId, dataId) {
        const dataIrrelevant = [18, 99, 100, 202, 216, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250]
        const dataAxis = [17, 162]
        return this.blocksDefault.find((item) => {
            if (dataAxis.indexOf(blockId) >= 0 && dataId >= 4) {
                let tempDataId = dataId % 4
                if (item.block_id === blockId && item.data_id === tempDataId && item.axis) {
                    return true
                }
            } else if (dataIrrelevant.indexOf(blockId) >= 0) {
                if (item.block_id === blockId) {
                    return true
                }
            } else if (item.block_id === blockId && item.data_id === dataId && !item.axis) {
                return true
            }
        })
    },
    showLoading() {
        document.querySelector('.loading-overlay').classList.add('is-active')
    },
    hideLoading() {
        document.querySelector('.loading-overlay').classList.remove('is-active')
    },
    startScreen: require('./screens/start.js').output,
    settingsScreen: require('./screens/settings.js').output,
    editorScreen: require('./screens/editor.js').output,
    convertScreen: require('./screens/convert.js').output,
    modals: {
        items: {},
        $root: document.querySelector('.modal'),
        $closeBtn: document.querySelector('.modal-close'),
        init() {
            const modalList = document.querySelectorAll('div[id^="modal-"]')
            modalList.forEach((item) => {
                const id = item.id.match(/(modal\-)(.*)/)[2]
                this.items[id] = item
            })
        },
        openModal(name) {
            this.$root.classList.add('is-active')
            for (let key in this.items) {
                this.items[key].classList.add('hidden')
            }
            this.items[name].classList.remove('hidden')
        },
        closeModal() {
            this.$root.classList.remove('is-active')
            for (let key in this.items) {
                const video = this.items[key].querySelector('iframe')
                if (video) {
                    video.src = video.src
                }
                this.items[key].classList.add('hidden')
            }
        }
    },
    errors: {
        items: {},
        init() {
            const errorList = document.querySelectorAll('div[id^="error-"]')
            errorList.forEach((item) => {
                const id = item.id.match(/(error\-)(.*)/)[2]
                this.items[id] = item
                item.classList.add('hidden')
            })
        },
        triggerError(id, text, timeout) {
            if (this.items[id]) {
                if (!this.items[id].classList.contains('hidden')) {
                    clearTimeout(this.items[id].timeout)
                    this.items[id].timeout = null
                }
                this.items[id].querySelector('.warning-body').innerHTML = text
                this.items[id].classList.remove('hidden')
                this.items[id].timeout = setTimeout(() => {
                    this.items[id].classList.add('hidden')
                    this.items[id].timeout = null
                }, timeout)
            } else {
                console.error('No error id!')
            }
        },
        closeError(id) {
            if (this.items[id]) {
                if (this.items[id].classList.contains('hidden')) { return }
                this.items[id].classList.add('hidden')
                if (this.items[id].timeout) {
                    clearTimeout(this.items[id].timeout)
                    this.items[id].timeout = null
                }
            } else {
                console.error('No error id!')
            }
        }
    },
    setEventListeners() {
        this.convertWorker.onmessage = (e) => {
            if (document.readyState !== 'complete') {
                store.waitForLoaded.arr = e.data
                store.waitForLoaded.width = store.canvasTemp.width
                store.waitForLoaded.height = store.canvasTemp.height
                return
            }
            store.hideLoading()
            this.settingsScreen.changeToEditorScreen()
            this.mineartCanvas.init(store.editorScreen.$canvas)
            this.mineartCanvas.setImageSizes(store.canvasTemp.width, store.canvasTemp.height)
            this.mineartCanvas.open(e.data)
            store.editorScreen.setEyedrop(1)
            store.editorScreen.setBrushSize(3)
        }

        this.modals.$closeBtn.onclick = () => {
            this.modals.closeModal()
        }

        window.addEventListener("load", function(event) {
            if (store.waitForLoaded.arr !== null) {
                console.log('waitedforload')
                store.settingsScreen.changeToEditorScreen()
                store.mineartCanvas.init(store.editorScreen.$canvas)
                store.mineartCanvas.setImageSizes(store.waitForLoaded.width, store.waitForLoaded.height)
                store.mineartCanvas.open(store.waitForLoaded.arr)
                store.waitForLoaded = null
                store.hideLoading()
            }
        });

        document.addEventListener("DOMContentLoaded", function(event) {
            document.body.style.display = 'block'
        });

        // window.onbeforeunload = function() {
        //    if (!store.isSaved) {
        //        return "DONT LEAVE";
        //    } else {
        //       return;
        //    }
        // };
    }
}

store.mineartCanvas.setBlocks(blocks)
blocks.sort((a, b) => {
    function rgb2hsv () {
        var rr, gg, bb,
            r = arguments[0] / 255,
            g = arguments[1] / 255,
            b = arguments[2] / 255,
            h, s,
            v = Math.max(r, g, b),
            diff = v - Math.min(r, g, b),
            diffc = function(c){
                return (v - c) / 6 / diff + 1 / 2;
            };

        if (diff == 0) {
            h = s = 0;
        } else {
            s = diff / v;
            rr = diffc(r);
            gg = diffc(g);
            bb = diffc(b);

            if (r === v) {
                h = bb - gg;
            }else if (g === v) {
                h = (1 / 3) + rr - bb;
            }else if (b === v) {
                h = (2 / 3) + gg - rr;
            }
            if (h < 0) {
                h += 1;
            }else if (h > 1) {
                h -= 1;
            }
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(v * 100)
        };
    }

    const aHsv = rgb2hsv(a.red, a.green, a.blue)
    const bHsv = rgb2hsv(b.red, b.green, b.blue)

    return aHsv.h - bHsv.h + aHsv.s - bHsv.s + bHsv.v - aHsv.v;
})

store.startScreen.init(store)
store.settingsScreen.init(store)
store.editorScreen.init(store)
store.convertScreen.init(store)
store.errors.init()
store.modals.init()
store.setEventListeners()
store.editorScreen.fillBlockList()


// const tempImage = new Image()
// tempImage.src = require('../static/pic_100.png')
// store.startScreen.changeToSettingsScreen()
// store.startScreen.uploadImage(tempImage.src)

// store.mineartCanvas.setSettingsValue('minecraftVersion', 13)
// tempImage.onload = (e) => {
//     // return
//     store.canvasTemp.width = tempImage.width
//     store.canvasTemp.height = tempImage.height
//     store.settingsScreen.ctxTemp.drawImage(tempImage, 0, 0, tempImage.width, tempImage.height)

//     const exclude = []
//     blocks.forEach((item) => {
//         if (item.luminance === true || item.transparency === true || item.redstone === true) {
//             exclude.push(item.id)
//         }
//     })

//     store.convertWorker.postMessage({
//         imgData: store.settingsScreen.ctxTemp.getImageData(0, 0, store.canvasTemp.width, store.canvasTemp.height).data,
//         exclude: exclude
//     })
//     store.startScreen.changeToEditorScreen()
// }

// window.mineartDOM = {
//     changeTool(tool) {
//         store.mineartCanvas.setTool(tool)
//     },
//     testShowPainted() {
//         return store.mineartCanvas.debugRenderAllPainted()
//     },
//     undo() {
//         store.mineartCanvas.undoOnce()
//     },
//     logStore() {
//         return store.mineartCanvas._debugReturnStore()
//     },
//     debugSaveHistory() {
//         store.mineartCanvas._debugSaveHistory()
//     },
//     debugCompareHistory() {
//         return store.mineartCanvas._debugCompareHistory()
//     },
//     replace(target, replace) {
//         return store.mineartCanvas.replace(target, replace)
//     },
//     setEyedrop(id) {
//         store.mineartCanvas.setEyedrop(id)
//     },
//     save() {
//         return store.mineartCanvas.save()
//     },
//     open() {
//         store.mineartCanvas.open()
//     },
//     convert() {
//         store.mineartCanvas._convertToGroups()
//     },
//     bucket(x, y, id) {
//         store.mineartCanvas._bucket(x, y, id)
//     }
// }
