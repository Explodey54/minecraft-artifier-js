'use strict'

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
    leftClick: false,
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
            store.editorScreen.closeTopbarMenus()
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
            store.editorScreen.resetScreen()
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

        document.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.querySelector('section.editor-screen').classList.contains('hidden')) {
                return
            }
            if (store.leftClick) { return }
            console.log(e.which)
            store.editorScreen.closeTopbarMenus()
            switch (e.which) {
                case 17:
                    store.mineartCanvas.setTool('clicker')
                    store.mineartCanvas.render()
                    break
                case 80:
                    document.querySelector('.editor-tools input[value="pencil"]').click()
                    break
                case 66:
                    document.querySelector('.editor-tools input[value="brush"]').click()
                    break
                case 85:
                    document.querySelector('.editor-tools input[value="bucket"]').click()
                    break
                case 69:
                    document.querySelector('.editor-tools input[value="eyedropper"]').click()
                    break
                case 90:
                    if (e.ctrlKey) {
                        store.editorScreen.undoOnce()
                    } else {
                        document.querySelector('.editor-tools input[value="zoom"]').click()
                    }
                    break
                case 89:
                    if (e.ctrlKey) {
                        store.editorScreen.redoOnce()
                    }
                    break
                case 71:
                    document.querySelector('.editor-tools input[value="grab"]').click()
                    break
                case 79:
                    store.editorScreen.$settingsOriginal.click()
                    break
                case 37:
                    store.mineartCanvas.moveOffset(1, 0)
                    break
                case 38:
                    store.mineartCanvas.moveOffset(0, 1)
                    break
                case 39:
                    store.mineartCanvas.moveOffset(-1, 0)
                    break
                case 40:
                    store.mineartCanvas.moveOffset(0, -1)
                    break
                case 219:
                    if (store.editorScreen.currentTool === 'pencil' || store.editorScreen.currentTool === 'brush') {
                        store.editorScreen.$brushMinus.click()
                    }
                    break
                case 221:
                    if (store.editorScreen.currentTool === 'pencil' || store.editorScreen.currentTool === 'brush') {
                        store.editorScreen.$brushPlus.click()
                    }
                    break
            }
        })

        document.addEventListener('keyup', (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.querySelector('section.editor-screen').classList.contains('hidden')) {
                return
            }
            if (store.leftClick) { return }
            switch (e.which) {
                case 17:
                    store.mineartCanvas.setTool(store.editorScreen.currentTool)
                    break
            }
        })

        document.addEventListener('mousedown', (e) => {
            store.leftClick = true
        })

        document.addEventListener('mouseup', (e) => {
            store.leftClick = false
        })
    }
}

store.mineartCanvas.setBlocks(blocks)
blocks.sort((a, b) => {
    return a.h - b.h + a.s - b.s + b.l - a.l;
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
