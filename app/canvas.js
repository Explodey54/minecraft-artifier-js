function MineartCanvas(canvasId) {
    const canvasMain = document.getElementById(canvasId)
    const ctxMain = canvasMain.getContext('2d')

    const canvasTemp = document.createElement('canvas')
    const ctxTemp = canvasTemp.getContext('2d')

    const _URL = window.URL || window.webkitURL
    const b64toBlob = require('b64-to-blob')

    const thisRoot = this

    const store = {
        blocksDb: require('../static/baked_blocks.json'),
        colorGroups: require('../static/baked_colors.json'),
        getBlockById(id) { return this.blocksDb[id - 1] },
        imageConvertedHex: false,
        imageWidth: 100,
        imageHeight: 100,
        canvasWidth: 1000,
        canvasHeight: 700,
        baseCellSize: 16,
        bound: false,
        layers: {
            loadedImage: false,
            paintedImage: {}
        },
        offset: {
            grabbed: false,
            bounds: {
                x: 500,
                y: 500
            },
            saved: {
                x: 0,
                y: 0
            },
            temp: {
                x: 0,
                y: 0
            },
            start: {},
            translate(x, y) {
                this.saved.x = x
                this.saved.y = y
            }
        },
        scale: {
            current: 1,
            options: [0.125, 0.25, 0.5, 1, 2, 4],
            cacheFrom: 1,
            scaleUp() {
                let indexOfCurrent = this.options.indexOf(this.current)
                if ( indexOfCurrent < this.options.length - 1 ) {
                    this.current = this.options[indexOfCurrent + 1]
                    return true
                }
                return false
            },
            scaleDown() { 
                let indexOfCurrent = this.options.indexOf(this.current)
                if ( indexOfCurrent > 0 ) {
                    this.current = this.options[indexOfCurrent - 1]
                    return true
                }
                return false
            }
        },
        interface: {
            eyedropCurrent: false,
            toolCurrent: false
        }
    }

    const mouseControls = {
        posMouse: {},
        leftClick: false
    }

    this.setImageSizes = function(w, h) {
        store.imageWidth = w
        store.imageHeight = h
    }

    this.setBound = function(obj) {
        store.bound = obj
    }

    this.setTool = function(str) {
        store.interface.toolCurrent = str
    }

    this.getTool = function() {
        return store.interface.toolCurrent
    }

    this.loadImageHex = function(str) {
        store.imageConvertedHex = str
        this.createBlobImage(str)
    }

    this.setCanvasSize = function(w, h) {
        store.canvasWidth = width
        store.canvasHeight = height
        canvasMain.width = width
        canvasMain.height = height
    }

    this.getBlockByPosition = function(x, y) {
        if (!store.imageConvertedHex) {
            return null
        }
        let sliceSingleBegin = 2 * (y * store.imageWidth + x)
        let blockHex = store.imageConvertedHex.slice(sliceSingleBegin, sliceSingleBegin + 2)
        return parseInt(blockHex, 16)
    }

    this.setEyedrop = function(id) {
        store.interface.eyedropCurrent = id
    }

    this.getEyedrop = function() {
        return store.interface.eyedropCurrent
    }

    this.createBlobImage = function(str) {
        canvasTemp.width = store.imageWidth * store.baseCellSize * store.scale.cacheFrom
        canvasTemp.height = store.imageHeight * store.baseCellSize * store.scale.cacheFrom

        const hexLength = store.imageConvertedHex.length
        for (let i = 0; i < hexLength; i += 2) {
            let x = ((i / 2)) % store.imageWidth + 1
            let y = Math.ceil((i + 1) / 2 / store.imageHeight)
            let imageForCanvas = store.getBlockById(parseInt(store.imageConvertedHex.slice(i, i + 2), 16)).image
            ctxTemp.drawImage(imageForCanvas,
                             (x - 1) * store.baseCellSize * store.scale.cacheFrom,
                             (y - 1) * store.baseCellSize * store.scale.cacheFrom,
                             store.baseCellSize * store.scale.cacheFrom,
                             store.baseCellSize * store.scale.cacheFrom)
        }

        store.layers.loadedImage = new Image()

        let blob = b64toBlob(canvasTemp.toDataURL().slice(22), 'image/png')

        store.layers.loadedImage.src = _URL.createObjectURL(blob)

        store.layers.loadedImage.onload = () => {
            const event = new Event('cached')
            canvasMain.dispatchEvent(event)
        }
    }

    this.paint = function(x, y, id) {
        if (!id) { return }
        let pointer = store.layers.paintedImage
        if (pointer['x' + x] === undefined) {
            pointer['x' + x] = {}
        }
        pointer = pointer['x' + x]
        pointer['y' + y] = id
    }

    this.render = function() {
        function renderPainted() {
            for (let x in store.layers.paintedImage) {
                for (let y in store.layers.paintedImage[x]) {
                    let xInt = parseInt(x.replace(/[xy]/, ''))
                    let yInt = parseInt(y.replace(/[xy]/, ''))
                    let imageForCanvas = store.getBlockById(store.layers.paintedImage[x][y]).image
                    ctxMain.drawImage(imageForCanvas,
                                      xInt * store.baseCellSize * store.scale.current + store.offset.saved.x, 
                                      yInt * store.baseCellSize * store.scale.current + store.offset.saved.y, 
                                      store.scale.current * store.baseCellSize, 
                                      store.scale.current * store.baseCellSize)
                }
            }
        }

        function renderByLoop() {
            let topLeftX = Math.floor((-store.offset.saved.x) / store.baseCellSize / store.scale.current)
            let topLeftY = Math.floor((-store.offset.saved.y) / store.baseCellSize / store.scale.current)
            let bottomRightX = Math.floor((store.canvasWidth - store.offset.saved.x) / store.baseCellSize / store.scale.current)
            let bottomRightY = Math.floor((store.canvasHeight - store.offset.saved.y) / store.baseCellSize / store.scale.current)

            if (topLeftX < 0) {
                topLeftX = 0
            }
            if (topLeftY < 0) {
                topLeftY = 0
            }
            if (bottomRightX < 0) {
                bottomRightX = 0
            }
            if (bottomRightY < 0) {
                bottomRightY = 0
            }

            var sliceBegin = 2 * (topLeftY * store.imageWidth + topLeftX)
            var sliceEnd = 2 * (bottomRightY * store.imageWidth + bottomRightX + 1) 
            let hexSlice = store.imageConvertedHex.slice(sliceBegin, sliceEnd)

            ctxMain.clearRect(0, 0, store.canvasWidth, store.canvasHeight)
            for (let y = topLeftY; y <= bottomRightY; y++) {
                for (let x = topLeftX; x <= bottomRightX; x++) {
                    if (x < store.imageWidth && y < store.imageHeight) {
                        let sliceSingleBegin = 2 * (y * store.imageWidth + x) - sliceBegin
                        let hexBlock = hexSlice.slice(sliceSingleBegin, sliceSingleBegin + 2)
                        let imageForCanvas = store.getBlockById(parseInt(hexBlock, 16)).image
                        ctxMain.drawImage(imageForCanvas, 
                                          x * store.baseCellSize * store.scale.current + store.offset.saved.x,
                                          y * store.baseCellSize * store.scale.current + store.offset.saved.y,
                                          store.scale.current * store.baseCellSize,
                                          store.scale.current * store.baseCellSize)
                    }
                }
            }
        }

        function renderByCache() {
            ctxMain.clearRect(0, 0, store.canvasWidth, store.canvasHeight)
            ctxMain.drawImage(store.layers.loadedImage, 
                              store.offset.saved.x, 
                              store.offset.saved.y, 
                              store.imageWidth * 16 * store.scale.current, 
                              store.imageHeight * 16 * store.scale.current)
        }

        if (store.scale.current > store.scale.cacheFrom) {
            renderByLoop()
            renderPainted()
        } else {
            renderByCache()
            renderPainted()
        }
    }

    this.init = function() {
        canvasMain.width = store.canvasWidth
        canvasMain.height = store.canvasHeight
        store.blocksDb.forEach((item) => {
            item.image = new Image()
            item.image.src = require('../static/textures/' + item.texture_image)
            delete item.texture_image
        })
        ctxMain.imageSmoothingEnabled = false
    }


    canvasMain.addEventListener('mousemove', function(e) {
        mouseControls.posMouse.x = e.clientX - store.bound.x
        mouseControls.posMouse.y = e.clientY - store.bound.y
        if (store.offset.grabbed) {
            store.offset.translate(mouseControls.posMouse.x - store.offset.start.x + store.offset.temp.x, mouseControls.posMouse.y - store.offset.start.y + store.offset.temp.y)
            thisRoot.render()
        }
        if (mouseControls.leftClick) {
            let xBlock = (Math.floor((mouseControls.posMouse.x - store.offset.saved.x) / (store.baseCellSize * store.scale.current)))
            let yBlock = (Math.floor((mouseControls.posMouse.y - store.offset.saved.y) / (store.baseCellSize * store.scale.current)))
            thisRoot.paint(xBlock, yBlock, thisRoot.getEyedrop())
            thisRoot.render()
        }
    })

    canvasMain.addEventListener('mousedown', function(e) {
        if (e.which === 1) {
            mouseControls.leftClick = true
            let xBlock = (Math.floor((mouseControls.posMouse.x - store.offset.saved.x) / (store.baseCellSize * store.scale.current)))
            let yBlock = (Math.floor((mouseControls.posMouse.y - store.offset.saved.y) / (store.baseCellSize * store.scale.current)))
            if (thisRoot.getTool() === 'eyedropper') {
                let id = thisRoot.getBlockByPosition(xBlock, yBlock)
                thisRoot.setEyedrop(id)
            } else {
                thisRoot.paint(xBlock, yBlock, thisRoot.getEyedrop())
                thisRoot.render()
            }
        }
        if (e.which === 2) {
            e.preventDefault()
            store.offset.grabbed = true
            store.offset.start.x = e.clientX - store.bound.x
            store.offset.start.y = e.clientY - store.bound.y
        }
    })

    document.addEventListener('mouseup', function(e) {
        store.offset.temp.x = store.offset.saved.x
        store.offset.temp.y = store.offset.saved.y
        store.offset.grabbed = false
        mouseControls.leftClick = false
    })

    canvasMain.addEventListener("wheel", (e) => {
        if (e.deltaY < 0) {
            if (store.scale.scaleUp()) {
                let x = Math.floor(mouseControls.posMouse.x - store.offset.saved.x)
                let y = Math.floor(mouseControls.posMouse.y - store.offset.saved.y)
                store.offset.temp.x = store.offset.saved.x - x
                store.offset.temp.y = store.offset.saved.y - y
                store.offset.translate(store.offset.saved.x - x, store.offset.saved.y - y)

                thisRoot.render()
            }
        }

        if (e.deltaY > 0) {
            if (store.scale.scaleDown()) {
                let x = Math.floor(mouseControls.posMouse.x - store.offset.saved.x)
                let y = Math.floor(mouseControls.posMouse.y - store.offset.saved.y)
                store.offset.temp.x = store.offset.saved.x + x / 2
                store.offset.temp.y = store.offset.saved.y + y / 2
                store.offset.translate(store.offset.saved.x + x / 2, store.offset.saved.y + y / 2)

                thisRoot.render()
            }
        }
    })

    this.init()
}

export default MineartCanvas
