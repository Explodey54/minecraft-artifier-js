// import './style.css'
import './style2.css'
import 'bulma/css/bulma.css'

import ConvertWorker from 'worker-loader!./convert.js'
import MineartCanvas from './canvas.js'
import SvgCroppy from './svgCroppy.js'
const _URL = window.URL || window.webkitURL

const blocks = require('../static/baked_blocks.json')
blocks.forEach((item) => {
    item.src = require('../static/textures/' + item.texture_image)
    delete item.texture_image
})

const canvasTemp = document.createElement('canvas')

const store = {
    blocksDefault: blocks,
    uploadedImage: new Image(),
    convertWorker: new ConvertWorker(),
    startScreen: {
        $dropzone: document.getElementById('start-dropzone'),
        $inputFile: document.getElementById('start-file-input'),
        changeToSettingsScreen() {
            document.querySelector('section.start-screen').classList.add('hidden')
            document.querySelector('section.settings-screen').classList.remove('hidden')
        },
        changeToEditorScreen() {
            document.querySelector('section.start-screen').classList.add('hidden')
            document.querySelector('section.editor-screen').classList.remove('hidden')
        },
        uploadImage(src) {
            store.uploadedImage.src = src
            store.uploadedImage.onload = () => {
                store.settingsScreen.$imgPres.src = src
                store.settingsScreen.$inputWidth.value = store.uploadedImage.width
                store.settingsScreen.$inputHeight.value = store.uploadedImage.height
                store.settingsScreen.aspectRatio = store.uploadedImage.width / store.uploadedImage.height
                store.settingsScreen.setImageSizesString(store.uploadedImage.width, store.uploadedImage.height)
                store.settingsScreen.setEqualsString(store.uploadedImage.width, store.uploadedImage.height)
                store.settingsScreen.fillTable()
                this.changeToSettingsScreen()
                store.settingsScreen.svgCroppy.init(store.settingsScreen.$imgPres)
                store.settingsScreen.svgCroppy.hide()
            }
        }
    },
    settingsScreen: {
        aspectRatio: null,
        svgCroppy: new SvgCroppy(),
        ctxTemp: canvasTemp.getContext('2d'),
        $imgPres: document.getElementById('settings-img-presentation'),
        $imgSizes: document.getElementById('settings-img-sizes'),
        $spanEquals: document.getElementById('settings-equals-blocks'),
        $inputWidth: document.getElementById('settings-input-width'),
        $inputHeight: document.getElementById('settings-input-height'),
        $checkboxCrop: document.getElementById('settings-check-crop'),
        $checkboxIgnoreRatio: document.getElementById('settings-check-ignore-ratio'),
        $boxGroupOptimized: document.getElementById('settings-group-optimized'),
        $boxGroupAll: document.getElementById('settings-group-all'),
        $boxGroupCustom: document.getElementById('settings-group-custom'),
        $tableBlocks: document.getElementById('settings-table-blocks'),
        $tableInput: document.getElementById('settings-input-filter'),
        $btnSubmit: document.getElementById('settings-submit'),
        fillTable() {
            const tbody = this.$tableBlocks.querySelector('tbody')
            store.blocksDefault.forEach((item) => {
                let row = document.createElement('tr')
                row.setAttribute('data-id', item.id)
                row.innerHTML = `
                    <td><input type="checkbox" checked></td>
                    <td><img src="${item.src}"></td>
                    <td>${item.name}</td>
                `
                tbody.appendChild(row)
            })
        },
        filterTable(name) {
            const regex = new RegExp(name, 'i') 
            store.blocksDefault.forEach((item) => {
                let row = this.$tableBlocks.querySelector(`tr[data-id='${item.id}']`)
                if (item.name.search(regex) < 0) {
                    row.classList.add('hidden')
                } else {
                    row.classList.remove('hidden')
                }
            })
        },
        setImageSizesString(w, h, crop) {
            this.$imgSizes.innerHTML = `Image size: ${w}x${h}`
        },
        setEqualsString(w, h) {
            if (parseInt(w) * parseInt(h) > 0) {
                this.$spanEquals.innerHTML = `${w*h} blocks`
            } else {
                this.$spanEquals.innerHTML = '??? blocks'
            }
        },
        selectBoxGroup(group) {
            this.$boxGroupOptimized.classList.remove('box-selected')
            this.$boxGroupAll.classList.remove('box-selected')
            this.$boxGroupCustom.classList.remove('box-selected')
            this.$tableBlocks.parentNode.classList.add('hidden')
            switch (group) {
                case 'optimized':
                    this.$boxGroupOptimized.classList.add('box-selected')
                    this.$boxGroupOptimized.querySelector('input[type=radio]').checked = true
                    break
                case 'all':
                    this.$boxGroupAll.classList.add('box-selected')
                    this.$boxGroupAll.querySelector('input[type=radio]').checked = true
                    break
                case 'custom':
                    this.$boxGroupCustom.classList.add('box-selected')
                    this.$boxGroupCustom.querySelector('input[type=radio]').checked = true
                    this.$tableBlocks.parentNode.classList.remove('hidden')
                    break
            }
        },
        drawToCanvas() {
            canvasTemp.width = parseInt(this.$inputWidth.value)
            canvasTemp.height = parseInt(this.$inputHeight.value)
            console.log(canvasTemp)
            this.ctxTemp.drawImage(store.uploadedImage, 0, 0, canvasTemp.width, canvasTemp.height)
        },
        changeToEditorScreen() {
            document.querySelector('section.settings-screen').classList.add('hidden')
            document.querySelector('section.editor-screen').classList.remove('hidden')
        }
    },
    editorScreen: {
        mineartCanvas: new MineartCanvas(),
        eyedropListener: null,
        currentHistoryPos: -1,
        $divCanvas: document.getElementById('editor-canvas'),
        $topbarBtns: document.querySelectorAll('.topbar-btn'),
        $replaceMenuTarget: document.getElementById('editor-replace-target'),
        $replaceMenuReplace: document.getElementById('editor-replace-replacement'),
        $replaceMenuBtn: document.getElementById('editor-replace-btn'),
        $replaceMenuInfo: document.getElementById('editor-replace-info'),
        $historyContainer: document.getElementById('editor-history'),
        setEyedropListener(node) {
            this.eyedropListener = node
            node.classList.add('active')
        },
        removeEyedropListener() {
            this.eyedropListener.classList.remove('active')
            this.eyedropListener = null
        }
    },
    setEventListeners() {
        //Start screen
        ////////////////////////////////////
        this.startScreen.$dropzone.ondragover = (e) => {
            e.preventDefault()
        }

        this.startScreen.$dropzone.ondrop = (e) => {
            e.preventDefault()
            this.startScreen.uploadImage(_URL.createObjectURL(e.dataTransfer.files[0]))
        }

        this.startScreen.$inputFile.onchange = (e) => {
            this.startScreen.uploadImage(_URL.createObjectURL(e.target.files[0]))
        }

        //Settings screen
        ////////////////////////////////////
        this.settingsScreen.$inputWidth.oninput = (e) => {
            this.settingsScreen.$inputHeight.value = Math.round(this.settingsScreen.$inputWidth.value / this.settingsScreen.aspectRatio)
            this.settingsScreen.setEqualsString(this.settingsScreen.$inputWidth.value, this.settingsScreen.$inputHeight.value)
        }

        this.settingsScreen.$inputHeight.oninput = (e) => {
            this.settingsScreen.$inputWidth.value = Math.round(this.settingsScreen.$inputHeight.value * this.settingsScreen.aspectRatio)
            this.settingsScreen.setEqualsString(this.settingsScreen.$inputWidth.value, this.settingsScreen.$inputHeight.value)
        }

        this.settingsScreen.$checkboxCrop.onchange = (e) => {
            if (e.target.checked) {
                this.settingsScreen.svgCroppy.unhide()
            } else {
                this.settingsScreen.svgCroppy.hide()
            }
        }

        this.settingsScreen.$boxGroupOptimized.onclick = (e) => {
            this.settingsScreen.selectBoxGroup('optimized')
        }

        this.settingsScreen.$boxGroupAll.onclick = (e) => {
            this.settingsScreen.selectBoxGroup('all')
        }

        this.settingsScreen.$boxGroupCustom.onclick = (e) => {
            this.settingsScreen.selectBoxGroup('custom')
        }

        this.settingsScreen.$tableInput.oninput = (e) => {
            this.settingsScreen.filterTable(this.settingsScreen.$tableInput.value)
        }

        this.settingsScreen.$btnSubmit.onclick = (e) => {
            this.settingsScreen.drawToCanvas()
            this.convertWorker.postMessage(this.settingsScreen.ctxTemp.getImageData(0, 0, canvasTemp.width, canvasTemp.height).data)
        }

        this.convertWorker.onmessage = (e) => {
            this.settingsScreen.changeToEditorScreen()
            this.editorScreen.mineartCanvas.setImageSizes(canvasTemp.width, canvasTemp.height)
            this.editorScreen.mineartCanvas.init(this.editorScreen.$divCanvas)
            this.editorScreen.mineartCanvas.open(e.data)
        }

        //Editor screen
        ////////////////////////////////////
        this.editorScreen.$topbarBtns.forEach((item) => {
            item.onclick = (e) => {
                if (e.target === item) {
                    item.querySelector('.topbar-menu').classList.toggle('hidden')
                }
            }
        })

        this.editorScreen.$replaceMenuTarget.onclick = (e) => {
            this.editorScreen.setEyedropListener(e.target)
        }

        this.editorScreen.$replaceMenuReplace.onclick = (e) => {
            this.editorScreen.setEyedropListener(e.target)
        }

        this.editorScreen.$replaceMenuBtn.onclick = (e) => {
            const id1 = parseInt(this.editorScreen.$replaceMenuTarget.dataset.blockId)
            const id2 = parseInt(this.editorScreen.$replaceMenuReplace.dataset.blockId)

            const replacedNum = this.editorScreen.mineartCanvas.replace(id1, id2)
            this.editorScreen.$replaceMenuInfo.classList.remove('hidden')
            this.editorScreen.$replaceMenuInfo.innerHTML = `${replacedNum} block(s) replaced.`
        }

        this.editorScreen.$divCanvas.onclick = (e) => {
            if (this.editorScreen.eyedropListener) {
                const info = this.editorScreen.mineartCanvas.getBlockInfoByMouseXY(e.x, e.y).info
                this.editorScreen.eyedropListener.setAttribute('data-block-id', info.id)
                this.editorScreen.eyedropListener.src = info.image.src
                const $title = this.editorScreen.eyedropListener.parentNode.querySelector('span')
                if ($title) {
                    $title.innerHTML = info.name
                }
                this.editorScreen.removeEyedropListener()
            }
        }

        this.editorScreen.$divCanvas.addEventListener('history', (e) => {
            const node = document.createElement('div')
            node.classList.add('info-panels-history-action')
            node.setAttribute('data-action-pos', e.details.pos)
            node.innerHTML = e.details.type
            node.onclick = () => {
                const actions = this.editorScreen.$historyContainer.querySelectorAll('.info-panels-history-action')
                actions.forEach((item) => {
                    if (item.dataset.actionPos > node.dataset.actionPos) {
                        item.classList.add('info-panels-history-action-returned')
                    } else {
                        item.classList.remove('info-panels-history-action-returned')
                    }
                })
                this.editorScreen.mineartCanvas.undoTo(parseInt(node.dataset.actionPos))
                this.editorScreen.currentHistoryPos = node.dataset.actionPos
            }
            this.editorScreen.currentHistoryPos = e.details.pos
            const actions = this.editorScreen.$historyContainer.querySelectorAll('.info-panels-history-action')
            actions.forEach((item) => {
                if (item.dataset.actionPos >= this.editorScreen.currentHistoryPos) {
                    item.remove()
                }
            })
            this.editorScreen.$historyContainer.appendChild(node)
        })



    }
}

store.editorScreen.mineartCanvas.setBlocks(blocks)
store.setEventListeners()
// const tempImage = new Image()
// tempImage.src = require('../static/lum_300.png')
// tempImage.onload = (e) => {
//     canvasTemp.width = tempImage.width
//     canvasTemp.height = tempImage.height
//     store.settingsScreen.ctxTemp.drawImage(tempImage, 0, 0, tempImage.width, tempImage.height)
//     store.convertWorker.postMessage(store.settingsScreen.ctxTemp.getImageData(0, 0, canvasTemp.width, canvasTemp.height).data)
//     store.startScreen.changeToEditorScreen()
// }

// window.mineartDOM = {
//     changeTool(tool) {
//         mineartCanvas.setTool(tool)
//     },
//     testShowPainted() {
//         return mineartCanvas.debugRenderAllPainted()
//     },
//     plusOneBrushSize() {
//         mineartCanvas.addToBrushSize(1)
//     },
//     minusOneBrushSize() {
//         mineartCanvas.addToBrushSize(-1)
//     },
//     undo() {
//         mineartCanvas.undoOnce()
//     },
//     logStore() {
//         return mineartCanvas._debugReturnStore()
//     },
//     debugSaveHistory() {
//         mineartCanvas._debugSaveHistory()
//     },
//     debugCompareHistory() {
//         return mineartCanvas._debugCompareHistory()
//     },
//     replace(target, replace) {
//         return mineartCanvas.replace(target, replace)
//     },
//     setEyedrop(id) {
//         mineartCanvas.setEyedrop(id)
//     },
//     save() {
//         return mineartCanvas.save()
//     },
//     open() {
//         mineartCanvas.open()
//     },
//     convert() {
//         mineartCanvas.convertAsCommandBlock('east')
//     }
// }
