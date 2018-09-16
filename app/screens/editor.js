const _URL = window.URL || window.webkitURL

const store = {
	parent: null,
    eyedropListener: null,
    mainEyedrop: null,
    currentHistoryPos: -1,
    noBlockImg: new Image(),
    currentTool: 'pencil',
    brushSize: 3,
    pencilSize: 3,
    maxHistory: 100,
    tempEyedrop: false,
    $topbarBtns: document.querySelectorAll('.topbar-btn'),
    init(parent) {
    	this.parent = parent
    	const nodeList = document.querySelectorAll('*[id^="editor-"]').forEach((item) => {
    		let key = '$'
    		item.id.split('-').forEach((str, i) => {
    			if (i > 1) {
    				key += str.charAt(0).toUpperCase() + str.slice(1)
    			} else if (i > 0) {
    				key += str
    			}
    		})
    		this[key] = item
    	})
    	this.setEventListeners()
    },
    setEyedropListener(node) {
        this.eyedropListener = node
        node.classList.add('active')
        store.parent.mineartCanvas.setTool('clicker')
    },
    removeEyedropListener() {
        if (this.eyedropListener) {
            this.eyedropListener.classList.remove('active')
            this.eyedropListener = null
            store.parent.mineartCanvas.setTool(this.currentTool)
        }
    },
    fillBlockList() {
        this.noBlockImg.src = require('../../static/textures/no_block.png')
        this.noBlockImg.onclick = () => {
            this.setEyedrop(0)
        }
        store.$blockList.appendChild(this.noBlockImg)
        store.parent.blocksDefault.forEach((item) => {
            const node = new Image()
            node.src = item.src
            node.classList.add('img-pixelated')
            node.setAttribute('data-block-id', item.id)
            node.onclick = () => {
                if (store.eyedropListener) {
                    store.eyedropListener.setAttribute('data-block-id', item.id)
                    store.eyedropListener.src = item.src
                    const $title = store.eyedropListener.parentNode.querySelector('span')
                    if ($title) {
                        $title.innerHTML = item.name
                    }
                    store.removeEyedropListener()
                } else {
                    this.setEyedrop(item.id)
                }
            }
            store.$blockList.appendChild(node)
        })
    },
    changeToSettingsScreen() {
        document.querySelector('section.editor-screen').classList.add('hidden')
        document.querySelector('section.convert-screen').classList.add('hidden')
        document.querySelector('section.settings-screen').classList.remove('hidden')
        store.parent.settingsScreen.resetScreen()
    },
    removeHistory() {
        document.querySelectorAll('.info-panels-history-action').forEach((item) => {
            item.remove()
        })
    },
    setEyedrop(int) {
        if (int != 0) {
            const block = store.parent.findBlockById(int)
            this.$mainEyedrop.src = block.src
        } else {
            this.$mainEyedrop.src = this.noBlockImg.src
        }
        this.mainEyedrop = int
        store.parent.mineartCanvas.setEyedrop(int)
    },
    filterBlockList(str) {
        store.parent.blocksDefault.forEach((item) => {
            const regex = new RegExp(str, 'i')
            if (item.name.match(regex)) {
                this.$blockList.querySelector(`img[data-block-id="${item.id}"]`).classList.remove('hidden')
            } else {
                this.$blockList.querySelector(`img[data-block-id="${item.id}"]`).classList.add('hidden')
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
        if (this.currentTool === 'pencil') {
            this.pencilSize = temp
        } else if (this.currentTool === 'brush') {
            this.brushSize = temp
        } else {
            this.pencilSize = temp
            this.brushSize = temp
        }
        store.parent.mineartCanvas.setBrushSize(temp)
    },
    resetScreen() {
        this.currentTool = 'pencil'
        this.brushSize = 3
        this.pencilSize = 3
        this.closeTopbarMenus()
        this.$settingsRulers.checked = true
        this.$settingsGrid.checked = false
        this.$settingsOriginal.checked = false
        this.$settingsGridColor.value = '#ff4778'
        this.setEyedrop(1)
        this.removeEyedropListener()
        this.$replaceReplacement.src = null
        this.$replaceTarget.src = null
        this.$replaceReplacement.parentNode.querySelector('span').innerHTML = '...'
        this.$replaceTarget.parentNode.querySelector('span').innerHTML = '...'
    },
    closeTopbarMenus() {
        document.querySelectorAll('.topbar-menu').forEach((item) => {
            item.classList.add('hidden')
        })
    },
    setEventListeners() {
    	this.$topbarBtns.forEach((item) => {
            item.onclick = (e) => {
                const menu = item.querySelector('.topbar-menu')
                if (e.target === item) {
                    if (menu.classList.contains('hidden')) {
                        this.closeTopbarMenus()
                        menu.classList.remove('hidden')
                    } else {
                        this.closeTopbarMenus()
                    }
                }
            }
        })

        this.$replaceTarget.onclick = (e) => {
            this.setEyedropListener(e.target)
        }

        this.$replaceReplacement.onclick = (e) => {
            this.setEyedropListener(e.target)
        }

        this.$replaceBtn.onclick = (e) => {
            const id1 = parseInt(this.$replaceTarget.dataset.blockId)
            const id2 = parseInt(this.$replaceReplacement.dataset.blockId)

            const replacedNum = store.parent.mineartCanvas.replace(id1, id2)
            this.$replaceInfo.classList.remove('hidden')
            this.$replaceInfo.innerHTML = `${replacedNum} block(s) replaced.`
        }

        this.$canvas.onmousedown = (e) => {
            if (e.which === 1 && this.$settingsOriginal.checked === true) {
                store.parent.mineartCanvas.setSettingsValue('showOriginal', false)
                this.$settingsOriginal.checked = false
                store.parent.mineartCanvas.render()
            }
        }

        this.$canvas.onclick = (e) => {
            const info = store.parent.mineartCanvas.getBlockInfoByMouseXY(e.x, e.y).info
            if (!info) { return }
            if (this.eyedropListener) {
                this.eyedropListener.setAttribute('data-block-id', info.id)
                this.eyedropListener.src = info.image.src
                const $title = this.eyedropListener.parentNode.querySelector('span')
                if ($title) {
                    $title.innerHTML = info.name
                }
                this.removeEyedropListener()
            }
            if (this.currentTool === 'eyedropper') {
                this.setEyedrop(info.id)
            }
        }

        this.$canvas.onmousemove = (e) => {
            const data = store.parent.mineartCanvas.getBlockInfoByMouseXY(e.x, e.y)
            if (data && data.info) {
                this.$footbarLeft.innerHTML = `
                    X: <b>${data.x}</b>, Y: <b>${data.y}</b>, Name: <b>${data.info.name}</b>, Game ID: <b>${data.info.game_id}</b> Pos: ${data.blockPos}
                `
            } else if (data) {
                this.$footbarLeft.innerHTML = `
                    X: <b>${data.x}</b>, Y: <b>${data.y}</b>, Name: <b>-</b>
                `
            } else {
                this.$footbarLeft.innerHTML = '...'
            }
        }

        this.$canvas.addEventListener('history', (e) => {
            store.parent.convertScreen.wasChanged = true
            store.parent.convertScreen.$notifyChanged.classList.remove('hidden')
            this.isSaved = false
            this.currentHistoryPos = e.details.pos

            let historyCounter = 0
            const actions = this.$history.querySelectorAll('.info-panels-history-action')
            actions.forEach((item) => {
                item.classList.remove('info-panels-history-action-current')
                if (parseInt(item.dataset.actionPos) >= parseInt(this.currentHistoryPos)) {
                    item.remove()
                    historyCounter--
                } else {
                    historyCounter++
                }
            })
            
            if (historyCounter === this.maxHistory) {
                const lastAction = this.$history.querySelector('.info-panels-history-action')
                lastAction.remove()
            }

            const node = document.createElement('div')
            node.classList.add('info-panels-history-action')
            node.classList.add('info-panels-history-action-current')
            node.classList.add('info-panels-history-action-' + e.details.type)
            node.setAttribute('data-action-pos', e.details.pos)
            node.innerHTML = e.details.type + ' ' + e.details.pos
            node.onclick = () => {
                if (this.$settingsOriginal.checked === true) {
                    store.parent.mineartCanvas.setSettingsValue('showOriginal', false)
                    store.parent.mineartCanvas.render()
                    this.$settingsOriginal.checked = false
                }
                this.$firstAction.classList.remove('info-panels-history-action-current')
                const actions = this.$history.querySelectorAll('.info-panels-history-action')
                actions.forEach((item) => {
                    item.classList.remove('info-panels-history-action-current')
                    if (parseInt(item.dataset.actionPos) > parseInt(node.dataset.actionPos)) {
                        item.classList.add('info-panels-history-action-returned')
                    } else {
                        item.classList.remove('info-panels-history-action-returned')
                    }
                })
                node.classList.add('info-panels-history-action-current')
                store.parent.mineartCanvas.undoTo(parseInt(node.dataset.actionPos))
                if (this.currentHistoryPos !== parseInt(node.dataset.actionPos)) {
                    store.parent.convertScreen.$notifyChanged.classList.remove('hidden')
                    this.isSaved = false
                }
                this.currentHistoryPos = parseInt(node.dataset.actionPos)
                store.parent.convertScreen.wasChanged = true
            }
            
            this.$firstAction.classList.remove('info-panels-history-action-current')
            this.$history.appendChild(node)
            this.$history.scrollTop = this.$history.scrollHeight
        })

        this.$firstAction.onclick = (e) => {
            e.target.classList.add('info-panels-history-action-current')
            const actions = this.$history.querySelectorAll('.info-panels-history-action')
            actions.forEach((item) => {
                item.classList.remove('info-panels-history-action-current')
                item.classList.add('info-panels-history-action-returned')
            })
            store.parent.mineartCanvas.undoTo(-1)
            if (this.currentHistoryPos !== -1) {
                store.parent.convertScreen.$notifyChanged.classList.remove('hidden')
                this.isSaved = false
            }
            this.currentHistoryPos = -1
            store.parent.convertScreen.wasChanged = true
        }

        this.$btnConvert.onclick = () => {
            document.querySelector('section.convert-screen').classList.remove('hidden')
            store.parent.convertScreen.convert()
            window.scrollTo(0,document.body.scrollHeight)
        }

        this.$saveBtn.onclick = () => {
            const link = store.parent.mineartCanvas.save(store.parent.convertScreen.$selectFacing.value)
            this.$saveBtn.href = link
            if (this.$saveInput.value) {
                this.$saveBtn.download = `${this.$saveInput.value}.schematic`
            }
            this.isSaved = true
        }

        this.$fileInputImage.oninput = (e) => {
            store.parent.startScreen.uploadImage(_URL.createObjectURL(e.target.files[0]))
            this.changeToSettingsScreen()
            this.removeHistory()
        }

        this.$fileInputData.onclick = (e) => {
            e.target.value = null
        }

        this.$fileInputData.oninput = (e) => {
            store.parent.startScreen.uploadSchematic(e.target.files[0])
            this.removeHistory()
        }

        this.$inputFilter.oninput = (e) => {
            this.filterBlockList(e.target.value)
        }

        document.querySelectorAll('input[name="tool"]').forEach((item) => {
            item.addEventListener('click', (e) => {
                const tool = e.target.value
                store.parent.mineartCanvas.setTool(tool)
                this.currentTool = tool
                if (tool === 'pencil') {
                    this.setBrushSize(this.pencilSize)
                    this.$brushShape.classList.remove('circle')
                    this.$brushContainer.classList.remove('hidden')
                } else if (tool === 'brush') {
                    this.setBrushSize(this.brushSize)
                    this.$brushShape.classList.add('circle')
                    this.$brushContainer.classList.remove('hidden')
                } else {
                    this.$brushContainer.classList.add('hidden')
                }
            })
        })

        this.$brushMinus.onclick = () => {
            if (this.currentTool === 'pencil') {
                this.setBrushSize(this.pencilSize - 1)
            } else if (this.currentTool === 'brush') {
                this.setBrushSize(this.brushSize - 1)
            }
        }

        this.$brushPlus.onclick = () => {
            if (this.currentTool === 'pencil') {
                this.setBrushSize(this.pencilSize + 1)
            } else if (this.currentTool === 'brush') {
                this.setBrushSize(this.brushSize + 1)
            }
        }

        this.$settingsGrid.onchange = (e) => {
            store.parent.mineartCanvas.setSettingsValue('showGrid', e.target.checked)
            store.parent.mineartCanvas.render()
        }

        this.$settingsRulers.onchange = (e) => {
            store.parent.mineartCanvas.setSettingsValue('showRulers', e.target.checked)
            store.parent.mineartCanvas.render()
        }

        this.$settingsOriginal.onchange = (e) => {
            store.parent.mineartCanvas.setSettingsValue('showOriginal', e.target.checked)
            store.parent.mineartCanvas.render()
        }

        this.$settingsGridColor.onchange = (e) => {
            store.parent.mineartCanvas.setSettingsValue('gridColor', e.target.value)
            store.parent.mineartCanvas.render()
        }
    }
}

export { store as output }