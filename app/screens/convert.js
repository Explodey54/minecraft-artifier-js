import Counter from '../models/counter.js'
const _URL = window.URL || window.webkitURL

const store = {
	parent: null,
    wasChanged: false,
    commBlockStrings: null,
    mcfunctionBlob: null,
    rawCommands: null,
    quantityOfBlocks: null,
    counterCommblock: new Counter(),
    counterRaw: new Counter(),
    counterManual: new Counter(),
    init(parent) {
    	this.parent = parent
    	const nodeList = document.querySelectorAll('*[id^="convert-"]').forEach((item) => {
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
    convert () {
        if (this.wasChanged) {
            store.parent.mineartCanvas.resetGroups()
            this.wasChanged = false
        }
        this.commBlockStrings = store.parent.mineartCanvas.convertAsCommandBlock(this.$selectFacing.value)
        this.mcfunctionBlob = new Blob([store.parent.mineartCanvas.convertAsMcfunction(this.$selectFacing.value)], {type : 'text/plain'})
        this.rawCommands = store.parent.mineartCanvas.convertAsRaw(this.$selectFacing.value)
        this.$btnMcfunction.href = _URL.createObjectURL(this.mcfunctionBlob)
        this.quantityOfBlocks = store.parent.mineartCanvas.getQuantityOfBlocks()

        this.$stringCommands.innerHTML = `Total commands: ${this.rawCommands.length}`

        this.counterCommblock.init(this.$counterCommblock)
        this.counterCommblock.setMax(this.commBlockStrings.length)
        this.counterCommblock.setCallback((int) => {
            this.$commblockTextarea.value = this.commBlockStrings[int - 1]
            store.parent.mineartCanvas.setSettingsValue('drawGroupsCurrent', int - 1)
            store.parent.mineartCanvas.render()
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
                const block = store.parent.findBlockById(parseInt(item.id))
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
        this.$stringDelete.innerHTML = store.parent.mineartCanvas.getCommandToDelete(this.$selectFacing.value).join('<br>')
        this.$notifyChanged.classList.add('hidden')
    },
    resetScreen() {
        this.$selectVersion.value = 12
        this.$selectMethod.value = 'commblock'
        this.$selectFacing.value = 'north'
        document.querySelector('section.convert-screen').classList.add('hidden')
        this.$outputCommblock.classList.remove('hidden')
        this.$outputMcfunction.classList.add('hidden')
        this.$outputRaw.classList.add('hidden')
        this.$outputManual.classList.add('hidden')
    },
    setEventListeners() {
        this.$selectMethod.onchange = (e) => {
            this.$outputCommblock.classList.add('hidden')
            this.$outputMcfunction.classList.add('hidden')
            this.$outputRaw.classList.add('hidden')
            this.$outputManual.classList.add('hidden')
            switch (e.target.value) {
                case 'commblock':
                    this.$outputCommblock.classList.remove('hidden')
                    break
                case 'mcfunction':
                    this.$outputMcfunction.classList.remove('hidden')
                    break
                case 'raw':
                    this.$outputRaw.classList.remove('hidden')
                    break
                case 'manual':
                    this.$outputManual.classList.remove('hidden')
                    break
            }
        }

        this.$selectFacing.onchange = (e) => {
            store.parent.editorScreen.$settingsWeDirection.value = e.target.value
            this.convert()
        }

        this.$btnMcfunction.onclick = (e) => {
            if (this.$inputMcfunction.value) {
                this.$btnMcfunction.classList.remove('border-danger')
                this.$btnMcfunction.download = `${this.$inputMcfunction.value}.mcfunction`
            } else {
                this.$btnMcfunction.classList.add('border-danger')
                e.preventDefault()
                return
            }
        }

        this.$copyClipboard.onclick = (e) => {
            e.preventDefault()
            this.$commblockTextarea.select()
            document.execCommand('copy')
        }

        this.$notifyLink.onclick = (e) => {
            e.preventDefault()
            this.convert()
            this.$notifyChanged.classList.add('hidden')
        }

        this.$selectVersion.onchange = (e) => {
            store.parent.mineartCanvas.setSettingsValue('minecraftVersion', parseInt(e.target.value))
            this.convert()
        }

        this.$howtoCommand.onclick = (e) => {
            e.preventDefault()
            store.parent.modals.openModal('howto-command')
        }
    }
}

export { store as output }