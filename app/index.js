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
    findBlockById(id) {
        return this.blocksDefault.find((item) => {
            if (item.id === id) {
                return true
            }
        })
    },
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
                store.settingsScreen.setEqualsString()
                store.settingsScreen.fillTable()
                this.changeToSettingsScreen()
                store.settingsScreen.svgCroppy = new SvgCroppy()
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
        svgCroppy: null,
        ctxTemp: canvasTemp.getContext('2d'),
        tableCounter: blocks.length,
        ignoreRatio: false,
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
        $strTableCounter: document.getElementById('settings-table-counter'),
        $btnSubmit: document.getElementById('settings-submit'),
        fillTable() {
            const tbody = this.$tableBlocks.querySelector('tbody')
            store.blocksDefault.forEach((item) => {
                let row = document.createElement('tr')
                row.innerHTML = `
                    <td><input type="checkbox" data-block-id="${item.id}" checked></td>
                    <td><img src="${item.src}" class="img-pixelated"></td>
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
                    this.setTableCounter()
                }
                row.onclick = (e) => {
                    if (e.target.localName === 'input') { return }
                    row.querySelector('input').click()
                }
                tbody.appendChild(row)
            })
            this.setTableCounter()
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
            this.$imgSizes.innerHTML = `Image size${crop ? ' (cropped)' : ''}: ${w}x${h}`
        },
        setEqualsString() {
            const w = parseInt(this.$inputWidth.value)
            const h = parseInt(this.$inputHeight.value)
            if (w * h > 0) {
                const int = w * h
                let output = ''
                const arr = int.toString().split('')
                arr.forEach((item, i) => {
                    output += item
                    if ((arr.length - i - 1) % 3 === 0 && arr.length - i !== 1) {
                        output += ','
                    }
                })
                this.$spanEquals.innerHTML = `${output} blocks`
            } else {
                this.$spanEquals.innerHTML = '??? blocks'
            }
        },
        setTableCounter() {
            const int = this.tableCounter
            const max = blocks.length 
            this.$strTableCounter.innerHTML = `${int}/${max} selected`
        },
        selectBoxGroup(group) {
            this.$boxGroupOptimized.classList.remove('box-selected')
            this.$boxGroupAll.classList.remove('box-selected')
            this.$boxGroupCustom.classList.remove('box-selected')
            document.querySelector('.table-blocks-container').classList.add('hidden')
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
                    document.querySelector('.table-blocks-container').classList.remove('hidden')
                    break
            }
        },
        drawToCanvas() {
            const inputWidth = parseInt(this.$inputWidth.value)
            const inputHeight = parseInt(this.$inputHeight.value)
            canvasTemp.width = inputWidth
            canvasTemp.height = inputHeight
            if (this.$checkboxCrop.checked) {
                const cropInfo = this.svgCroppy.getCropInfo()
                const widthCropRatio = inputWidth / cropInfo.width 
                const heightCropRatio = inputHeight / cropInfo.height
                this.ctxTemp.drawImage(store.uploadedImage, 
                                       -cropInfo.offsetX * widthCropRatio, 
                                       -cropInfo.offsetY * heightCropRatio,
                                       store.uploadedImage.width * widthCropRatio, 
                                       store.uploadedImage.height * heightCropRatio)
            } else {
                this.ctxTemp.drawImage(store.uploadedImage, 0, 0, canvasTemp.width, canvasTemp.height)
            }
        },
        changeToEditorScreen() {
            document.querySelector('section.settings-screen').classList.add('hidden')
            document.querySelector('section.editor-screen').classList.remove('hidden')
        }
    },
    editorScreen: {
        eyedropListener: null,
        mainEyedrop: null,
        currentHistoryPos: -1,
        noBlockImg: new Image(),
        currentTool: 'pencil',
        brushSize: null,
        $divCanvas: document.getElementById('editor-canvas'),
        $topbarBtns: document.querySelectorAll('.topbar-btn'),
        $saveBtn: document.getElementById('editor-save-btn'),
        $replaceMenuTarget: document.getElementById('editor-replace-target'),
        $replaceMenuReplace: document.getElementById('editor-replace-replacement'),
        $replaceMenuBtn: document.getElementById('editor-replace-btn'),
        $replaceMenuInfo: document.getElementById('editor-replace-info'),
        $historyContainer: document.getElementById('editor-history'),
        $historyFirstAction: document.getElementById('editor-first-action'),        
        $blocksList: document.getElementById('editor-block-list'),
        $btnConvert: document.getElementById('editor-btn-convert'),
        $inputImage: document.getElementById('editor-file-input-image'),
        $inputData: document.getElementById('editor-file-input-data'),
        $inputFilter: document.getElementById('editor-input-filter'),
        $brushContainer: document.getElementById('editor-brush-container'),
        $brushShape: document.getElementById('editor-brush-shape'),
        $brushString: document.getElementById('editor-brush-string'),
        $brushMinus: document.getElementById('editor-brush-minus'),
        $brushPlus: document.getElementById('editor-brush-plus'),
        $mainEyedrop: document.getElementById('editor-main-eyedrop'),
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
            this.noBlockImg.src = require('../static/textures/no_block.png')
            this.noBlockImg.onclick = () => {
                this.setEyedrop(0)
            }
            store.editorScreen.$blocksList.appendChild(this.noBlockImg)
            store.blocksDefault.forEach((item) => {
                const node = new Image()
                node.src = item.src
                node.classList.add('img-pixelated')
                node.setAttribute('data-block-id', item.id)
                node.onclick = () => {
                    this.setEyedrop(item.id)
                }
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
        },
        setEyedrop(int) {
            if (int != 0) {
                const block = store.findBlockById(int)
                this.$mainEyedrop.src = block.src
            } else {
                this.$mainEyedrop.src = this.noBlockImg.src
            }
            this.mainEyedrop = int
            store.mineartCanvas.setEyedrop(int)
        },
        filterBlockList(str) {
            store.blocksDefault.forEach((item) => {
                const regex = new RegExp(str, 'i')
                if (item.name.match(regex)) {
                    this.$blocksList.querySelector(`img[data-block-id="${item.id}"]`).classList.remove('hidden')
                } else {
                    this.$blocksList.querySelector(`img[data-block-id="${item.id}"]`).classList.add('hidden')
                }
            })
        },
        setBrushSize(int) {
            let temp 
            if (int > 25) {
                temp = 25
            } else if (int < 1) {
                temp = 1
            } else {
                temp = int
            }
            const size = temp < 3 ? 3 : temp
            this.$brushShape.style.width = (size % 2 ? size : size - 1) + 'px'
            this.$brushShape.style.height = (size % 2 ? size : size - 1) + 'px'
            this.$brushString.innerHTML = `${temp} bl.`
            this.brushSize = temp
            store.mineartCanvas.setBrushSize(temp)
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
            if (!this.settingsScreen.ignoreRatio) {
                this.settingsScreen.$inputHeight.value = Math.round(this.settingsScreen.$inputWidth.value / this.settingsScreen.aspectRatio)
            }
            this.settingsScreen.setEqualsString()
        }

        this.settingsScreen.$inputHeight.oninput = (e) => {
            if (!this.settingsScreen.ignoreRatio) {
                this.settingsScreen.$inputWidth.value = Math.round(this.settingsScreen.$inputHeight.value * this.settingsScreen.aspectRatio)
            }
            this.settingsScreen.setEqualsString()
        }

        this.settingsScreen.$checkboxCrop.onchange = (e) => {
            if (e.target.checked) {
                this.settingsScreen.svgCroppy.unhide()
                const cropInfo = this.settingsScreen.svgCroppy.getCropInfo()
                this.settingsScreen.setImageSizesString(cropInfo.width, cropInfo.height, true)
                this.settingsScreen.aspectRatio = cropInfo.width / cropInfo.height
            } else {
                this.settingsScreen.svgCroppy.hide()
                this.settingsScreen.setImageSizesString(store.uploadedImage.width, store.uploadedImage.height)
                this.settingsScreen.aspectRatio = this.uploadedImage.width / this.uploadedImage.height
                this.settingsScreen.$inputWidth.value = this.uploadedImage.width
                this.settingsScreen.$inputHeight.value = this.uploadedImage.height
            }
            this.settingsScreen.setEqualsString()
        }

        this.settingsScreen.$checkboxIgnoreRatio.onchange = (e) => {
            this.settingsScreen.ignoreRatio = e.target.checked
            const icon = document.querySelector('.size-inputs i')
            if (e.target.checked === false) {
                this.settingsScreen.$inputHeight.value = Math.round(this.settingsScreen.$inputWidth.value / this.settingsScreen.aspectRatio)
                this.settingsScreen.$inputWidth.value = Math.round(this.settingsScreen.$inputHeight.value * this.settingsScreen.aspectRatio)
                this.settingsScreen.setEqualsString()
                icon.style.opacity = 1
            } else {
                icon.style.opacity = 0.3
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
            this.settingsScreen.setTableCounter()
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
            store.editorScreen.setEyedrop(1)
            store.editorScreen.setBrushSize(2)
        }

        this.settingsScreen.$imgPres.addEventListener('croppytransformed', (e) => {
            const cropInfo = this.settingsScreen.svgCroppy.getCropInfo()
            this.settingsScreen.setImageSizesString(cropInfo.width, cropInfo.height, true)
            this.settingsScreen.aspectRatio = cropInfo.width / cropInfo.height
            if (!this.settingsScreen.ignoreRatio) {
                this.settingsScreen.$inputHeight.value = Math.round(this.settingsScreen.$inputWidth.value / this.settingsScreen.aspectRatio)
                this.settingsScreen.$inputWidth.value = Math.round(this.settingsScreen.$inputHeight.value * this.settingsScreen.aspectRatio)
            }
            this.settingsScreen.setEqualsString()
        })

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
            const info = this.mineartCanvas.getBlockInfoByMouseXY(e.x, e.y).info
            if (this.editorScreen.eyedropListener) {
                this.editorScreen.eyedropListener.setAttribute('data-block-id', info.id)
                this.editorScreen.eyedropListener.src = info.image.src
                const $title = this.editorScreen.eyedropListener.parentNode.querySelector('span')
                if ($title) {
                    $title.innerHTML = info.name
                }
                this.editorScreen.removeEyedropListener()
            }
            if (this.editorScreen.currentTool === 'eyedropper') {
                this.editorScreen.setEyedrop(info.id)
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
                    if (parseInt(item.dataset.actionPos) > parseInt(node.dataset.actionPos)) {
                        item.classList.add('info-panels-history-action-returned')
                    } else {
                        item.classList.remove('info-panels-history-action-returned')
                    }
                })
                this.mineartCanvas.undoTo(parseInt(node.dataset.actionPos))
                this.editorScreen.currentHistoryPos = parseInt(node.dataset.actionPos)
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

        this.editorScreen.$historyFirstAction.onclick = () => {
            const actions = this.editorScreen.$historyContainer.querySelectorAll('.info-panels-history-action')
            actions.forEach((item) => {
                item.classList.add('info-panels-history-action-returned')
            })
            this.mineartCanvas.undoTo(-1)
            this.editorScreen.currentHistoryPos = -1
        }

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

        this.editorScreen.$inputFilter.oninput = (e) => {
            this.editorScreen.filterBlockList(e.target.value)
        }

        document.querySelectorAll('input[name="tool"]').forEach((item) => {
            item.addEventListener('click', (e) => {
                this.editorScreen.currentTool = e.target.value
                if (e.target.value === 'pencil') {
                    this.editorScreen.$brushShape.classList.remove('circle')
                    this.editorScreen.$brushContainer.classList.remove('hidden')
                } else if (e.target.value === 'brush') {
                    this.editorScreen.$brushShape.classList.add('circle')
                    this.editorScreen.$brushContainer.classList.remove('hidden')
                } else {
                    this.editorScreen.$brushContainer.classList.add('hidden')
                }
            })
        })

        this.editorScreen.$brushMinus.onclick = () => {
            this.editorScreen.setBrushSize(this.editorScreen.brushSize - 1)
        }

        this.editorScreen.$brushPlus.onclick = () => {
            this.editorScreen.setBrushSize(this.editorScreen.brushSize + 1)
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
store.setEventListeners()
store.editorScreen.fillBlockList()

const tempImage = new Image()
tempImage.src = require('../static/pic_184.jpg')
// store.startScreen.changeToSettingsScreen()
store.startScreen.uploadImage(tempImage.src)
tempImage.onload = (e) => {

    // return
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
    },
    bucket(x, y, id) {
        store.mineartCanvas._bucket(x, y, id)
    }
}
