// import './style.css'
import './style2.css'
import 'bulma/css/bulma.css'

import ConvertWorker from 'worker-loader!./convert.js'
import MineartCanvas from './canvas.js'
import SvgCroppy from './svgCroppy.js'
import Counter from './counter.js'
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
    mineartCanvas: new MineartCanvas(),
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
        },
        uploadDataFile(file) {
            const reader = new FileReader()
            reader.readAsArrayBuffer(file)
            reader.onloadend = (e) => {
                const data = new DataView(reader.result),
                      version = data.getUint8(0),
                      blocksType = data.getUint8(1),
                      width = data.getUint16(2),
                      height = data.getUint16(4)
                const uint8Array = new Uint8Array(width * height)

                for (let i = 6; i < data.byteLength; i++) {
                    uint8Array[i - 6] = data.getUint8(i)
                }

                this.changeToEditorScreen()
                store.mineartCanvas.setImageSizes(width, height)
                store.mineartCanvas.init(store.editorScreen.$divCanvas)
                store.mineartCanvas.open(uint8Array)
            }
        }
    },
    settingsScreen: {
        aspectRatio: null,
        svgCroppy: new SvgCroppy(),
        ctxTemp: canvasTemp.getContext('2d'),
        tableCounter: blocks.length,
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
        $tableCheckbox: document.getElementById('settings-table-checkbox'),
        $btnSubmit: document.getElementById('settings-submit'),
        fillTable() {
            const tbody = this.$tableBlocks.querySelector('tbody')
            store.blocksDefault.forEach((item) => {
                let row = document.createElement('tr')
                row.innerHTML = `
                    <td><input type="checkbox" data-block-id="${item.id}" checked></td>
                    <td><img src="${item.src}"></td>
                    <td>${item.name}</td>
                `
                row.querySelector('input').oninput = (e) => {
                    if (e.target.checked) {
                        this.tableCounter += 1
                    } else {
                        this.tableCounter -= 1
                    }

                    if (this.tableCounter === 0) {
                        this.$tableCheckbox.checked = false
                    } else if (this.tableCounter === blocks.length) {
                        this.$tableCheckbox.indeterminate = false
                        this.$tableCheckbox.checked = true
                    } else {
                        this.$tableCheckbox.indeterminate = true
                        this.$tableCheckbox.checked = true
                    }
                    console.log(this.tableCounter)
                }
                row.onclick = (e) => {
                    if (e.target.localName === 'input') { return }
                    row.querySelector('input').click()
                }
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
            this.ctxTemp.drawImage(store.uploadedImage, 0, 0, canvasTemp.width, canvasTemp.height)
        },
        changeToEditorScreen() {
            document.querySelector('section.settings-screen').classList.add('hidden')
            document.querySelector('section.editor-screen').classList.remove('hidden')
        }
    },
    editorScreen: {
        eyedropListener: null,
        currentHistoryPos: -1,
        $divCanvas: document.getElementById('editor-canvas'),
        $topbarBtns: document.querySelectorAll('.topbar-btn'),
        $saveBtn: document.getElementById('editor-save-btn'),
        $replaceMenuTarget: document.getElementById('editor-replace-target'),
        $replaceMenuReplace: document.getElementById('editor-replace-replacement'),
        $replaceMenuBtn: document.getElementById('editor-replace-btn'),
        $replaceMenuInfo: document.getElementById('editor-replace-info'),
        $historyContainer: document.getElementById('editor-history'),
        $blocksList: document.getElementById('editor-block-list'),
        $btnConvert: document.getElementById('editor-btn-convert'),
        $inputImage: document.getElementById('editor-file-input-image'),
        $inputData: document.getElementById('editor-file-input-data'),
        $footbar: document.getElementById('editor-footbar'),
        setEyedropListener(node) {
            this.eyedropListener = node
            node.classList.add('active')
        },
        removeEyedropListener() {
            this.eyedropListener.classList.remove('active')
            this.eyedropListener = null
        },
        fillBlockList() {
            store.blocksDefault.forEach((item) => {
                const node = new Image()
                node.src = item.src
                node.classList.add('img-pixelated')
                node.setAttribute('data-block-id', item.id)
                store.editorScreen.$blocksList.appendChild(node)
            })
        },
        changeToSettingsScreen() {
            document.querySelector('section.editor-screen').classList.add('hidden')
            document.querySelector('section.convert-screen').classList.add('hidden')
            document.querySelector('section.settings-screen').classList.remove('hidden')
        },
        removeHistory() {
            document.querySelectorAll('.info-panels-history-action').forEach((item) => {
                item.remove()
            })
        }
    },
    convertScreen: {
        wasChanged: true,
        commBlockStrings: null,
        mcfunctionBlob: null,
        rawCommands: null,
        quantityOfBlocks: null,
        counterCommblock: new Counter(),
        counterRaw: new Counter(),
        counterManual: new Counter(),
        $commBlockTextarea: document.getElementById('convert-commblock-textarea'),
        $selectMethod: document.getElementById('convert-select-method'),
        $selectVersion: document.getElementById('convert-select-version'),
        $selectDirection: document.getElementById('convert-select-direction'),
        $outputCommblock: document.getElementById('convert-output-commblock'),
        $outputMcfunction: document.getElementById('convert-output-mcfunction'),
        $outputRaw: document.getElementById('convert-output-raw'),
        $outputManual: document.getElementById('convert-output-manual'),
        $counterCommblock: document.getElementById('convert-counter-commblock'),
        $counterRaw: document.getElementById('convert-counter-raw'),
        $counterManual: document.getElementById('convert-counter-manual'),
        $btnMcfunction: document.getElementById('convert-btn-mcfunction'),
        $inputMcfunction: document.getElementById('convert-input-mcfunction'),
        $preRaw: document.getElementById('convert-pre-raw'),
        $tableManual: document.getElementById('convert-table-manual'),
        $stringTotalComms: document.getElementById('convert-string-commands'),
        convert () {
            if (this.wasChanged) {
                store.mineartCanvas.resetGroups()
                this.wasChanged = false
            }
            this.commBlockStrings = store.mineartCanvas.convertAsCommandBlock(this.$selectDirection.value)
            this.mcfunctionBlob = new Blob([store.mineartCanvas.convertAsMcfunction(this.$selectDirection.value)], {type : 'text/plain'})
            this.rawCommands = store.mineartCanvas.convertAsRaw(this.$selectDirection.value)
            this.$btnMcfunction.href = _URL.createObjectURL(this.mcfunctionBlob)
            this.quantityOfBlocks = store.mineartCanvas.getQuantityOfBlocks()

            this.$stringTotalComms.innerHTML = `Total commands: ${this.rawCommands.length}`

            this.counterCommblock.init(this.$counterCommblock)
            this.counterCommblock.setMax(this.commBlockStrings.length)
            this.counterCommblock.setCallback((int) => {
                this.$commBlockTextarea.value = this.commBlockStrings[int - 1]
            })
            this.counterCommblock.setValue(1)

            this.counterRaw.init(this.$counterRaw)
            const commandsOnPage = 1000
            this.counterRaw.setMax(Math.ceil(this.rawCommands.length / commandsOnPage))
            this.counterRaw.setCallback((int) => {
                const slice = this.rawCommands.slice((int - 1) * commandsOnPage, commandsOnPage * int)
                let output = ''
                slice.forEach((item) => {
                    output += `<span>${item}</span>\n`
                })
                this.$preRaw.style.counterIncrement = 'line ' + (int - 1) * commandsOnPage
                this.$preRaw.innerHTML = output
            })
            this.counterRaw.setValue(1)

            const rowsOnPage = 10
            const $tbody = this.$tableManual.querySelector('tbody')
            this.counterManual.init(this.$counterManual)
            this.counterManual.setMax(Math.ceil(this.quantityOfBlocks.length / rowsOnPage))
            this.counterManual.setCallback((int) => {
                $tbody.innerHTML = ''
                const slice = this.quantityOfBlocks.slice((int - 1) * rowsOnPage, rowsOnPage * int)
                slice.forEach((item) => {
                    const $row = document.createElement('tr')
                    const block = store.blocksDefault[item.id - 1]
                    let quantityStr = ''
                    if (item.quant > 63) {
                        quantityStr += `${Math.floor(item.quant / 64)} stacks`
                        if (item.quant % 64 !== 0) {
                            quantityStr += ` + ${item.quant % 64} blocks`
                        }
                    } else {
                        quantityStr += `${item.quant} blocks`
                    }
                    $row.innerHTML = `<td><img class="img-pixelated" src="${block.src}"></td><td>${block.name}</td><td>${quantityStr}</td>`
                    $tbody.appendChild($row)
                })
            })
            this.counterManual.setValue(1)
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
            const regexp = /(.*)\.([^.]*)/
            const ext = e.dataTransfer.files[0].name.match(regexp)[2]
            if (ext == 'jpeg' || ext == 'jpg' || ext == 'png') {
                this.startScreen.uploadImage(_URL.createObjectURL(e.dataTransfer.files[0]))
            } else if (ext == 'data') {
                this.startScreen.uploadDataFile(e.dataTransfer.files[0])
            }
        }

        this.startScreen.$inputFile.onchange = (e) => {
            const regexp = /(.*)\.([^.]*)/
            const ext = e.target.files[0].name.match(regexp)[2]
            if (ext == 'jpeg' || ext == 'jpg' || ext == 'png') {
                this.startScreen.uploadImage(_URL.createObjectURL(e.target.files[0]))
            } else if (ext == 'data') {
                this.startScreen.uploadDataFile(e.target.files[0])
            }
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

        this.settingsScreen.$tableCheckbox.oninput = (e) => {
            const checkboxes = this.settingsScreen.$tableBlocks.querySelectorAll('tbody input')
            if (e.target.checked) {
                checkboxes.forEach((item) => {
                    item.checked = true
                })
                this.settingsScreen.tableCounter = blocks.length
            } else {
                checkboxes.forEach((item) => {
                    item.checked = false
                })
                this.settingsScreen.tableCounter = 0
            }
        }

        this.settingsScreen.$btnSubmit.onclick = (e) => {
            const excludeArr = []
            const blockGroup = document.querySelector('input[name=block-groups]:checked').value
            switch (blockGroup) {
                case 'all':
                    break
                case 'optimized':
                    blocks.forEach((item) => {
                        if (item.luminance === true || item.transparency === true || item.redstone === true) {
                            excludeArr.push(item.id)
                        }
                    })
                    break
                case 'custom':
                    this.settingsScreen.$tableBlocks.querySelectorAll('input').forEach((item) => {
                        if (item.checked === false) {
                            excludeArr.push(parseInt(item.dataset.blockId))
                        }
                    })
                    break
            }
            this.settingsScreen.drawToCanvas()
            this.convertWorker.postMessage({
                imgData: this.settingsScreen.ctxTemp.getImageData(0, 0, canvasTemp.width, canvasTemp.height).data,
                exclude: excludeArr
            })
        }

        this.convertWorker.onmessage = (e) => {
            this.settingsScreen.changeToEditorScreen()
            this.mineartCanvas.setImageSizes(canvasTemp.width, canvasTemp.height)
            this.mineartCanvas.init(this.editorScreen.$divCanvas)
            this.mineartCanvas.open(e.data)
            // store.convertScreen.convert()
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

            const replacedNum = this.mineartCanvas.replace(id1, id2)
            this.editorScreen.$replaceMenuInfo.classList.remove('hidden')
            this.editorScreen.$replaceMenuInfo.innerHTML = `${replacedNum} block(s) replaced.`
        }

        this.editorScreen.$divCanvas.onclick = (e) => {
            if (this.editorScreen.eyedropListener) {
                const info = this.mineartCanvas.getBlockInfoByMouseXY(e.x, e.y).info
                this.editorScreen.eyedropListener.setAttribute('data-block-id', info.id)
                this.editorScreen.eyedropListener.src = info.image.src
                const $title = this.editorScreen.eyedropListener.parentNode.querySelector('span')
                if ($title) {
                    $title.innerHTML = info.name
                }
                this.editorScreen.removeEyedropListener()
            }
        }

        this.editorScreen.$divCanvas.onmousemove = (e) => {
            const data = this.mineartCanvas.getBlockInfoByMouseXY(e.x, e.y)
            if (data && data.info) {
                this.editorScreen.$footbar.innerHTML = `
                    X: <b>${data.x}</b>, Y: <b>${data.y}</b>, Name: <b>${data.info.name}</b>, Game ID: <b>${data.info.game_id}</b> Pos: ${data.blockPos}
                `
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
                this.mineartCanvas.undoTo(parseInt(node.dataset.actionPos))
                this.editorScreen.currentHistoryPos = node.dataset.actionPos
            }
            this.editorScreen.currentHistoryPos = e.details.pos
            const actions = this.editorScreen.$historyContainer.querySelectorAll('.info-panels-history-action')
            actions.forEach((item) => {
                if (parseInt(item.dataset.actionPos) >= parseInt(this.editorScreen.currentHistoryPos)) {
                    item.remove()
                }
            })
            this.editorScreen.$historyContainer.appendChild(node)
        })

        this.editorScreen.$btnConvert.onclick = () => {
            document.querySelector('section.convert-screen').classList.remove('hidden')
            this.convertScreen.convert()
        }

        this.editorScreen.$saveBtn.onclick = () => {
            const link = this.mineartCanvas.save()
            this.editorScreen.$saveBtn.href = link
            this.editorScreen.$saveBtn.download = 'data.data'
        }

        this.editorScreen.$inputImage.oninput = (e) => {
            this.startScreen.uploadImage(_URL.createObjectURL(e.target.files[0]))
            this.editorScreen.changeToSettingsScreen()
            this.editorScreen.removeHistory()
        }

        this.editorScreen.$inputData.onclick = (e) => {
            e.target.value = null
        }

        this.editorScreen.$inputData.oninput = (e) => {
            this.startScreen.uploadDataFile(e.target.files[0])
            this.editorScreen.removeHistory()
        }

        //Convert screen
        ////////////////////////////////////
        this.convertScreen.$selectMethod.onchange = (e) => {
            this.convertScreen.$outputCommblock.classList.add('hidden')
            this.convertScreen.$outputMcfunction.classList.add('hidden')
            this.convertScreen.$outputRaw.classList.add('hidden')
            this.convertScreen.$outputManual.classList.add('hidden')
            switch (e.target.value) {
                case 'commblock':
                    this.convertScreen.$outputCommblock.classList.remove('hidden')
                    break
                case 'mcfunction':
                    this.convertScreen.$outputMcfunction.classList.remove('hidden')
                    break
                case 'raw':
                    this.convertScreen.$outputRaw.classList.remove('hidden')
                    break
                case 'manual':
                    this.convertScreen.$outputManual.classList.remove('hidden')
                    break
            }
        }

        this.convertScreen.$selectDirection.onchange = () => {
            this.convertScreen.convert()
        }

        this.convertScreen.$inputMcfunction.oninput = (e) => {
            this.convertScreen.$btnMcfunction.download = e.target.value + '.mcfunction'
        }
    }
}

store.mineartCanvas.setBlocks(blocks)
store.setEventListeners()
store.editorScreen.fillBlockList()

const tempImage = new Image()
tempImage.src = require('../static/pic_184.jpg')
store.startScreen.changeToSettingsScreen()
store.startScreen.uploadImage(tempImage.src)
tempImage.onload = (e) => {

    return
    canvasTemp.width = tempImage.width
    canvasTemp.height = tempImage.height
    store.settingsScreen.ctxTemp.drawImage(tempImage, 0, 0, tempImage.width, tempImage.height)

    const exclude = []
    blocks.forEach((item) => {
        if (item.luminance === true || item.transparency === true || item.redstone === true) {
            exclude.push(item.id)
        }
    })

    store.convertWorker.postMessage({
        imgData: store.settingsScreen.ctxTemp.getImageData(0, 0, canvasTemp.width, canvasTemp.height).data,
        exclude: exclude
    })
    store.startScreen.changeToEditorScreen()
}

window.mineartDOM = {
    changeTool(tool) {
        store.mineartCanvas.setTool(tool)
    },
    testShowPainted() {
        return store.mineartCanvas.debugRenderAllPainted()
    },
    plusOneBrushSize() {
        store.mineartCanvas.addToBrushSize(1)
    },
    minusOneBrushSize() {
        store.mineartCanvas.addToBrushSize(-1)
    },
    undo() {
        store.mineartCanvas.undoOnce()
    },
    logStore() {
        return store.mineartCanvas._debugReturnStore()
    },
    debugSaveHistory() {
        store.mineartCanvas._debugSaveHistory()
    },
    debugCompareHistory() {
        return store.mineartCanvas._debugCompareHistory()
    },
    replace(target, replace) {
        return store.mineartCanvas.replace(target, replace)
    },
    setEyedrop(id) {
        store.mineartCanvas.setEyedrop(id)
    },
    save() {
        return store.mineartCanvas.save()
    },
    open() {
        store.mineartCanvas.open()
    },
    convert() {
        store.mineartCanvas._convertToGroups()
    }
}
