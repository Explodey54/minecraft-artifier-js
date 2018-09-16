import SvgCroppy from '../models/svgCroppy.js'
const _URL = window.URL || window.webkitURL

const store = {
	svgCroppy: new SvgCroppy(),
	parent: null,
    aspectRatio: null,
    ctxTemp: null,
    ignoreRatio: false,
    init(parent) {
    	this.parent = parent
    	const nodeList = document.querySelectorAll('*[id^="settings-"]').forEach((item) => {
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
    	this.ctxTemp = store.parent.canvasTemp.getContext('2d')
    	this.setEventListeners()
    },
    fillTable() {
        const tbody = this.$tableBlocks.querySelector('tbody')
        store.parent.blocksDefault.forEach((item) => {
            let row = document.createElement('tr')
            row.classList.add('visible')
            row.innerHTML = `
                <td><input type="checkbox" data-block-id="${item.id}" checked></td>
                <td><img src="${item.src}" class="img-pixelated"></td>
                <td>${item.name}</td>
            `
            row.querySelector('input').oninput = (e) => {
                this.setTableCounter()
            }
            row.onclick = (e) => {
                store.parent.errors.closeError('settings-screen')
                if (e.target.localName === 'input') { return }
                row.querySelector('input').click()
            }
            tbody.appendChild(row)
        })
        this.setTableCounter()
    },
    filterTable(name) {
        const regex = new RegExp(name, 'i') 
        store.parent.blocksDefault.forEach((item) => {
            let row = this.$tableBlocks.querySelector(`input[data-block-id='${item.id}']`).parentNode.parentNode
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
            this.$equalsBlocks.innerHTML = `${output} blocks`
        } else {
            this.$equalsBlocks.innerHTML = '??? blocks'
        }
    },
    setTableCounter() {
        // const hidden = this.$tableBlocks.querySelectorAll('tr.hidden').length
        const max = this.$tableBlocks.querySelectorAll('tr.visible').length
        const int = this.$tableBlocks.querySelectorAll('tr.visible td input:checked').length
        
        if (int === 0) {
            this.$tableCheckbox.checked = false
        } else if (int === max) {
            this.$tableCheckbox.indeterminate = false
            this.$tableCheckbox.checked = true
        } else {
            this.$tableCheckbox.indeterminate = true
            this.$tableCheckbox.checked = true
        }

        this.$tableCounter.innerHTML = `${int}/${max} selected`
    },
    selectBoxGroup(group) {
        this.$groupSurvival.classList.remove('box-selected')
        this.$groupAll.classList.remove('box-selected')
        this.$groupCustom.classList.remove('box-selected')
        document.querySelector('.table-blocks-container').classList.add('hidden')
        document.getElementById('settings-checkboxes-include').classList.remove('hidden')
        switch (group) {
            case 'survival':
                this.$groupSurvival.classList.add('box-selected')
                this.$groupSurvival.querySelector('input[type=radio]').checked = true
                break
            case 'all':
                this.$groupAll.classList.add('box-selected')
                this.$groupAll.querySelector('input[type=radio]').checked = true
                break
            case 'custom':
                this.$groupCustom.classList.add('box-selected')
                this.$groupCustom.querySelector('input[type=radio]').checked = true
                document.querySelector('.table-blocks-container').classList.remove('hidden')
                document.getElementById('settings-checkboxes-include').classList.add('hidden')
                break
        }
    },
    drawToCanvas() {
        this.ctxTemp.imageSmoothingEnabled = false
        const inputWidth = parseInt(this.$inputWidth.value)
        const inputHeight = parseInt(this.$inputHeight.value)
        store.parent.canvasTemp.width = inputWidth
        store.parent.canvasTemp.height = inputHeight
        if (this.$checkCrop.checked) {
            const cropInfo = this.svgCroppy.getCropInfo()
            if (store.parent.uploadedImage.naturalHeight > 500) {
                cropInfo.height = store.parent.uploadedImage.naturalHeight / store.parent.$imgPresentation.height * cropInfo.height
                cropInfo.width = store.parent.uploadedImage.naturalWidth / store.parent.$imgPresentation.width * cropInfo.width
                cropInfo.offsetY = store.parent.uploadedImage.naturalHeight / store.parent.$imgPresentation.height * cropInfo.offsetY
                cropInfo.offsetX = store.parent.uploadedImage.naturalWidth / store.parent.$imgPresentation.width * cropInfo.offsetX
            }

            store.parent.mineartCanvas.setOriginalImage({
                src: store.parent.uploadedImage.src,
                x: cropInfo.offsetX,
                y: cropInfo.offsetY,
                width: cropInfo.width,
                height: cropInfo.height
            })

            const widthCropRatio = inputWidth / cropInfo.width
            const heightCropRatio = inputHeight / cropInfo.height 
            this.ctxTemp.drawImage(store.parent.uploadedImage, 
                                   -cropInfo.offsetX * widthCropRatio, 
                                   -cropInfo.offsetY * heightCropRatio,
                                   store.parent.uploadedImage.naturalWidth * widthCropRatio, 
                                   store.parent.uploadedImage.naturalHeight * heightCropRatio)
        } else {
            this.ctxTemp.drawImage(store.parent.uploadedImage, 0, 0, store.parent.canvasTemp.width, store.parent.canvasTemp.height)
            store.parent.mineartCanvas.setOriginalImage({
                src: store.parent.uploadedImage.src,
                x: 0,
                y: 0,
                width: store.parent.uploadedImage.width,
                height: store.parent.uploadedImage.height
            })
        }
    },
    changeToEditorScreen() {
        document.querySelector('section.settings-screen').classList.add('hidden')
        document.querySelector('section.editor-screen').classList.remove('hidden')
        if (store.parent.uploadedType === 'schem') {
            store.parent.editorScreen.$settingsOriginal.disabled = true
        } else {
            store.parent.editorScreen.$settingsOriginal.disabled = false
        }
        store.parent.editorScreen.resetScreen()
    },
    resetScreen() {
        this.$groupAll.click()
        this.$checkCrop.checked = false
        this.$checkIgnoreRatio.checked = false
        document.querySelectorAll('#settings-checkboxes-include input').forEach((item) => {
            item.checked = false
        })
        document.querySelector('#settings-checkboxes-include input[name="include-falling"]').checked = true
    },
    setEventListeners() {
    	        this.$inputWidth.oninput = (e) => {
            e.target.value = e.target.value.replace(/\D/gi, '')
            if (!this.ignoreRatio) {
                this.$inputHeight.value = Math.round(this.$inputWidth.value / this.aspectRatio)
            }
            this.setEqualsString()
        }

        this.$inputHeight.oninput = (e) => {
            e.target.value = e.target.value.replace(/\D/gi, '')
            if (!this.ignoreRatio) {
                this.$inputWidth.value = Math.round(this.$inputHeight.value * this.aspectRatio)
            }
            this.setEqualsString()
        }

        this.$checkCrop.onchange = (e) => {
            if (e.target.checked) {
                this.svgCroppy.unhide()
                const cropInfo = this.svgCroppy.getCropInfo()
                if (store.parent.uploadedImage.naturalHeight > 500) {
                    cropInfo.width = Math.round(store.parent.uploadedImage.naturalWidth / store.$imgPresentation.width * cropInfo.width)
                    cropInfo.height = Math.round(store.parent.uploadedImage.naturalHeight / store.$imgPresentation.height * cropInfo.height)
                }
                this.setImageSizesString(cropInfo.width, cropInfo.height, true)
                this.aspectRatio = cropInfo.width / cropInfo.height
            } else {
                this.svgCroppy.hide()
                this.setImageSizesString(store.parent.uploadedImage.naturalWidth, store.parent.uploadedImage.naturalHeight)
                this.aspectRatio = store.parent.uploadedImage.width / store.parent.uploadedImage.height
                this.$inputWidth.value = store.parent.uploadedImage.width
                this.$inputHeight.value = store.parent.uploadedImage.height
            }
            this.setEqualsString()
        }

        this.$checkIgnoreRatio.onchange = (e) => {
            this.ignoreRatio = e.target.checked
            const icon = document.querySelector('.size-inputs i')
            if (e.target.checked === false) {
                this.$inputHeight.value = Math.round(this.$inputWidth.value / this.aspectRatio)
                this.$inputWidth.value = Math.round(this.$inputHeight.value * this.aspectRatio)
                this.setEqualsString()
                icon.style.opacity = 1
            } else {
                icon.style.opacity = 0.3
            }
        }

        this.$groupSurvival.onclick = (e) => {
            this.selectBoxGroup('survival')
        }

        this.$groupAll.onclick = (e) => {
            this.selectBoxGroup('all')
        }

        this.$groupCustom.onclick = (e) => {
            this.selectBoxGroup('custom')
        }

        this.$inputFilter.oninput = (e) => {
            this.filterTable(this.$inputFilter.value)
        }

        this.$tableCheckbox.oninput = (e) => {
            const checkboxes = this.$tableBlocks.querySelectorAll('tbody input')
            if (e.target.checked) {
                checkboxes.forEach((item) => {
                    item.checked = true
                })
                this.tableCounter = blocks.length
            } else {
                checkboxes.forEach((item) => {
                    item.checked = false
                })
                this.tableCounter = 0
            }
            this.setTableCounter()
        }

        this.$version.onchange = (e) => {
            store.parent.blocksDefault.forEach((item) => {
                let row = this.$tableBlocks.querySelector(`input[data-block-id='${item.id}']`).parentNode.parentNode
                if (item.version > parseInt(e.target.value)) {
                    row.classList.remove('visible')
                } else {
                    row.classList.add('visible')
                }
            })
            this.setTableCounter()
        }

        this.$submit.onclick = (e) => {
            const excludeArr = []
            const blockGroup = document.querySelector('input[name=block-groups]:checked').value
            if (this.$inputHeight.value > 256) {
                store.parent.errors.triggerError('settings-screen', 'Maximum height is 256.', 7000)
                return
            }

            switch (blockGroup) {
                case 'all':
                    break
                case 'survival':
                    store.parent.blocksDefault.forEach((item) => {
                        if (item.survival !== true) {
                            excludeArr.push(item.id)
                        }
                    })
                    break
                case 'custom':
                    const max = this.$tableBlocks.querySelectorAll('tr.visible').length
                    let int = 0
                    this.$tableBlocks.querySelectorAll('td input').forEach((item) => {
                        if (item.checked === false) {
                            excludeArr.push(parseInt(item.dataset.blockId))
                            int++
                        }
                    })
                    if (int >= max - 1) {
                        store.parent.errors.triggerError('settings-screen', 'Please select at least 2 blocks.', 7000)
                        return
                    }
                    break
            }
            if (blockGroup === 'all' || blockGroup === 'survival') {
                if (document.querySelector('input[name=include-transparent]').checked === false) {
                    store.parent.blocksDefault.forEach((item) => {
                        if (item.transparency === true) {
                            excludeArr.push(item.id)
                        }
                    })
                }
                if (document.querySelector('input[name=include-falling]').checked === false) {
                    store.parent.blocksDefault.forEach((item) => {
                        if (item.falling === true) {
                            excludeArr.push(item.id)
                        }
                    })
                }
                if (document.querySelector('input[name=include-redstone]').checked === false) {
                    store.parent.blocksDefault.forEach((item) => {
                        if (item.redstone === true) {
                            excludeArr.push(item.id)
                        }
                    })
                }
                if (document.querySelector('input[name=include-luminance]').checked === false) {
                    store.parent.blocksDefault.forEach((item) => {
                        if (item.luminance === true) {
                            excludeArr.push(item.id)
                        }
                    })
                }
            }
            const version = parseInt(this.$version.value)
            if (version < 13) {
                store.parent.blocksDefault.forEach((item) => {
                    if (item.version > version) {
                        excludeArr.push(item.id)
                    }
                })
            } else {
                store.parent.blocksDefault.forEach((item) => {
                    if (item.game_id === 'minecraft:dried_kelp_block') {
                        excludeArr.push(item.id)
                    }
                })
            }
            store.parent.mineartCanvas.setSettingsValue('minecraftVersion', version)
            // store.parent.convertScreen.$version.value = version

            this.drawToCanvas()
            store.parent.editorScreen.$footbarRight.innerHTML = `Width: <b>${store.parent.canvasTemp.width} bl.</b> | Height: <b>${store.parent.canvasTemp.height} bl.</b>`
            store.parent.showLoading()
            store.parent.convertWorker.postMessage({
                imgData: this.ctxTemp.getImageData(0, 0, store.parent.canvasTemp.width, store.parent.canvasTemp.height).data,
                exclude: excludeArr
            })
        }

        this.$imgPresentation.addEventListener('croppytransformed', (e) => {
            const cropInfo = this.svgCroppy.getCropInfo()
            if (store.parent.uploadedImage.naturalWidth > 500) {
                cropInfo.width = Math.round(store.parent.uploadedImage.naturalWidth / store.$imgPresentation.width * cropInfo.width)
                cropInfo.height = Math.round(store.parent.uploadedImage.naturalHeight / store.$imgPresentation.height * cropInfo.height)
            }
            this.setImageSizesString(cropInfo.width, cropInfo.height, true)
            this.aspectRatio = cropInfo.width / cropInfo.height
            if (!this.ignoreRatio) {
                this.$inputHeight.value = Math.round(this.$inputWidth.value / this.aspectRatio)
                this.$inputWidth.value = Math.round(this.$inputHeight.value * this.aspectRatio)
            }
            this.setEqualsString()
        })
    }
}

export { store as output }