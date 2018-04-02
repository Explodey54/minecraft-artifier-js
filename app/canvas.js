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
        imageConvertedHex: null,
        imageWidth: null,
        imageHeight: null,
        canvasWidth: 1000,
        canvasHeight: 700,
        baseCellSize: 16,
        boundingRect: null,
        layers: {
            loadedImage: null,
            paintedImage: {}
        },
        offset: {
            bounds: {
                x: 500,
                y: 500
            },
            x: 0,
            y: 0,
            translate(x, y) {
                this.x = Math.round(x)
                this.y = Math.round(y)
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
            eyedropCurrent: null,
            toolCurrent: null
        },
        events: {
            cached: new Event('cached')
        },
        debug: { //delete in prod!!!
            renderTime: {
                '0.125': 0,
                '0.25': 0,
                '0.5': 0,
                '1': 0,
                '2': 0,
                '4': 0
            }
        }
    }

    this._getCornersOfVisible = () => {
        let topLeftX = Math.floor((-store.offset.x) / store.baseCellSize / store.scale.current)
        let topLeftY = Math.floor((-store.offset.y) / store.baseCellSize / store.scale.current)
        let bottomRightX = Math.floor((store.canvasWidth - store.offset.x) / store.baseCellSize / store.scale.current)
        let bottomRightY = Math.floor((store.canvasHeight - store.offset.y) / store.baseCellSize / store.scale.current)

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

        return {
            topLeftX: topLeftX,
            topLeftY: topLeftY,
            bottomRightX: bottomRightX,
            bottomRightY: bottomRightY
        }
    }

    this._getBlockIdByPosition = (x, y) => {
        if (!store.imageConvertedHex) {
            return null
        }
        if (x < 0 || x >= store.imageWidth || y < 0 || y >= store.imageHeight) {
            return null
        }

        let blockHex = store.imageConvertedHex[y * store.imageWidth + x]
        return parseInt(blockHex, 16)
    }

    this._createBlobImage = (str) => {
        canvasTemp.width = store.imageWidth * store.baseCellSize * store.scale.cacheFrom
        canvasTemp.height = store.imageHeight * store.baseCellSize * store.scale.cacheFrom

        for (let i = 0; i < store.imageConvertedHex.length; i++) {
            let x = (i) % store.imageWidth + 1
            let y = Math.ceil((i + 1) / store.imageWidth)
            let imageForCanvas = store.getBlockById(parseInt(store.imageConvertedHex[i], 16)).image
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
            canvasMain.dispatchEvent(store.events.cached)
        }
    }

    this._setEventListeners = function() {
        const controls = {
            mouse: {
                localX: null,
                localY: null,
                grabbed: false,
                leftClick: false,
                startX: 0,
                startY: 0,
                oldOffsetX: null,
                oldOffsetY: null,
            }
        }

        canvasMain.addEventListener('mousemove', function(e) {
            controls.mouse.localX = e.pageX - store.boundingRect.x - controls.mouse.startX
            controls.mouse.localY = e.pageY - store.boundingRect.y - controls.mouse.startY
            if (controls.mouse.grabbed) {
                store.offset.translate(controls.mouse.localX + controls.mouse.oldOffsetX, controls.mouse.localY + controls.mouse.oldOffsetY)
                thisRoot.render()
            }
            if (controls.mouse.leftClick) {
                let xBlock = (Math.floor((controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
                let yBlock = (Math.floor((controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))
                thisRoot.paint(xBlock, yBlock, thisRoot.getEyedrop())
                thisRoot.render()
            }
        })

        canvasMain.addEventListener('mousedown', function(e) {
            if (e.which === 1) {
                controls.mouse.leftClick = true
                let xBlock = (Math.floor((controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
                let yBlock = (Math.floor((controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))
                if (thisRoot.getTool() === 'eyedropper') {
                    let id = thisRoot._getBlockIdByPosition(xBlock, yBlock)
                    thisRoot.setEyedrop(id)
                } else {
                    thisRoot.paint(xBlock, yBlock, thisRoot.getEyedrop())
                    thisRoot.render()
                }
            }
            if (e.which === 2) {
                e.preventDefault()
                controls.mouse.grabbed = true
                controls.mouse.startX = e.clientX - store.boundingRect.x
                controls.mouse.startY = e.clientY - store.boundingRect.y
                controls.mouse.oldOffsetX = store.offset.x
                controls.mouse.oldOffsetY = store.offset.y
            }
        })

        document.addEventListener('mouseup', function(e) {
            controls.mouse.grabbed = false
            controls.mouse.leftClick = false
            controls.mouse.startX = 0
            controls.mouse.startY = 0
        })

        canvasMain.addEventListener("wheel", (e) => {
            e.preventDefault()
            if (e.deltaY < 0) {
                if (store.scale.scaleUp()) {
                    let x = Math.floor(controls.mouse.localX - store.offset.x)
                    let y = Math.floor(controls.mouse.localY - store.offset.y)
                    store.offset.translate(store.offset.x - x, store.offset.y - y)
                    thisRoot.render()
                }
            }

            if (e.deltaY > 0) {
                if (store.scale.scaleDown()) {
                    let x = Math.floor(controls.mouse.localX - store.offset.x)
                    let y = Math.floor(controls.mouse.localY - store.offset.y)
                    store.offset.translate(store.offset.x + x / 2, store.offset.y + y / 2)
                    thisRoot.render()
                }
            }
        })
    }

    this.getBlockInfoByMouseXY = (pageX, pageY) => {
        let xBlock = (Math.floor((pageX - store.boundingRect.x - store.offset.x) / (store.baseCellSize * store.scale.current)))
        let yBlock = (Math.floor((pageY - store.boundingRect.y - store.offset.y) / (store.baseCellSize * store.scale.current)))
        return {
            x: xBlock,
            y: store.imageHeight - yBlock - 1,
            info: store.getBlockById(this._getBlockIdByPosition(xBlock, yBlock))
        } 
    }

    this.setImageSizes = (w, h) => {
        store.imageWidth = parseInt(w)
        store.imageHeight = parseInt(h)
    }

    this.setBoundingRect = (obj) => {
        store.boundingRect = obj
    }

    this.setTool = (str) => {
        store.interface.toolCurrent = str
    }

    this.getTool = () => {
        return store.interface.toolCurrent
    }

    this.loadImageHex = (arr) => {
        store.imageConvertedHex = arr
        this._createBlobImage(arr)
    }

    this.setEyedrop = (id) => {
        store.interface.eyedropCurrent = id
    }

    this.getEyedrop = () => {
        return store.interface.eyedropCurrent
    }

    this.paint = (x, y, id) => {
        if (!id) { return }
        let pointer = store.layers.paintedImage
        if (pointer['x' + x] === undefined) {
            pointer['x' + x] = {}
        }
        pointer = pointer['x' + x]
        pointer['y' + y] = id
    }

    this.render = function() {
        function renderRulerLines() {
            let rulerSizeHorizontal = 25,
                rulerSizeVertical = 25,
                rulerFillStyle = 'white',
                fontStyle = '12px Helvetica'


            let drawRulerEveryNBlocks
            switch (store.scale.current) {
                case 4:
                    drawRulerEveryNBlocks = 10
                    break
                case 2:
                    drawRulerEveryNBlocks = 10
                    break
                case 1:
                    drawRulerEveryNBlocks = 10
                    break
                case 0.5:
                    drawRulerEveryNBlocks = 20
                    break
                case 0.25:
                    drawRulerEveryNBlocks = 50
                    break
                case 0.125:
                    drawRulerEveryNBlocks = 100
                    break
            }

            if (store.imageHeight >= 1000) {
                rulerSizeVertical = 36
            }

            ctxMain.fillStyle = rulerFillStyle
            ctxMain.rect(0, store.canvasHeight - rulerSizeHorizontal, store.canvasWidth, rulerSizeHorizontal)
            ctxMain.fill()
            ctxMain.rect(0, 0, rulerSizeVertical, store.canvasHeight)
            ctxMain.fill()

            ctxMain.font = fontStyle;
            ctxMain.fillStyle = 'black'
            ctxMain.strokeStyle = 'black'
            ctxMain.lineWidth = 1
            // gets lastleft/lastright visible n/coordsX and draws everything between them

            for (let i = Math.ceil(-store.offset.x / store.scale.current / 16 / drawRulerEveryNBlocks) * drawRulerEveryNBlocks;
                 i <= Math.floor((-store.offset.x + store.canvasWidth) / store.scale.current / 16 / drawRulerEveryNBlocks) * drawRulerEveryNBlocks; 
                 i += drawRulerEveryNBlocks) {
                ctxMain.beginPath()
                ctxMain.moveTo(i * store.scale.current * 16 + store.offset.x + 0.5, store.canvasHeight)
                ctxMain.lineTo(i * store.scale.current * 16 + store.offset.x + 0.5, store.canvasHeight - rulerSizeHorizontal)
                ctxMain.stroke()
                ctxMain.fillText(i, i * store.scale.current * 16 + store.offset.x + 2, store.boundingRect.height - 10)
            }

            for (let i = Math.floor((store.offset.y / 16 / store.scale.current + store.imageHeight) / drawRulerEveryNBlocks) * drawRulerEveryNBlocks;
                 i >= Math.floor(((store.offset.y - store.canvasHeight) / 16 / store.scale.current + store.imageHeight) / drawRulerEveryNBlocks) * drawRulerEveryNBlocks; 
                 i -= drawRulerEveryNBlocks) {
                ctxMain.beginPath()
                ctxMain.moveTo(0, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y + 0.5) // + 0.5 for just the right thickness
                ctxMain.lineTo(rulerSizeVertical, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y + 0.5)
                ctxMain.stroke()
                ctxMain.fillText(i, 1, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y - 3)
            }

            ctxMain.rect(0, store.canvasHeight - rulerSizeHorizontal, rulerSizeVertical, rulerSizeHorizontal)
            ctxMain.fill()
        }

        function renderGrid() {
            let lineWidthBig = 2,
                lineWidthSmall = 1,
                strokeStyle = '#ff4778'

            let mainGridLineEveryN
            switch (store.scale.current) {
                case 4:
                    mainGridLineEveryN = 10
                    break
                case 2:
                    mainGridLineEveryN = 10
                    break
                case 1:
                    mainGridLineEveryN = 20
                    break
                case 0.5:
                    mainGridLineEveryN = 20
                    break
                case 0.25:
                    mainGridLineEveryN = 50
                    break
                case 0.125:
                    mainGridLineEveryN = 50
                    break
            }

            ctxMain.lineWidth = lineWidthBig
            ctxMain.strokeStyle = strokeStyle

            let topOfGridVertical = -store.offset.y >= 0 ? 0 : store.offset.y
            let bottomOfGridVertical = store.offset.y + store.imageHeight * 16 * store.scale.current
            let topOfGridHorizontal = store.offset.x < 0 ? 0 : store.offset.x
            let bottomOfGridHorizontal = store.offset.x + store.imageWidth * 16 * store.scale.current

            if (bottomOfGridVertical > store.canvasHeight) {
                bottomOfGridVertical = store.canvasHeight
            }
            if (bottomOfGridHorizontal > store.canvasWidth) {
                bottomOfGridHorizontal = store.canvasWidth
            }

            let startOfRenderGridHorizontal = Math.ceil((store.offset.y - store.canvasHeight) / 16 / store.scale.current + store.imageHeight)
            let endOfRenderGridHorizontal = Math.floor(store.offset.y / 16 / store.scale.current + store.imageHeight)

            let startOfRenderGridVertical = Math.ceil(-store.offset.x / 16 / store.scale.current)
            let endOfRenderGridVertical = Math.floor((-store.offset.x + store.canvasWidth) / store.scale.current / 16)

            if (startOfRenderGridHorizontal <= 0) { 
                startOfRenderGridHorizontal = 0
            }
            if (endOfRenderGridHorizontal >= store.imageHeight) {
                endOfRenderGridHorizontal = store.imageHeight
            }

            if (startOfRenderGridVertical <= 0) { 
                startOfRenderGridVertical = 0
            }
            if (endOfRenderGridVertical >= store.imageWidth) {
                endOfRenderGridVertical = store.imageWidth
            }

            for (let i = startOfRenderGridHorizontal; i <= endOfRenderGridHorizontal; i += 1) {
                ctxMain.beginPath()
                if (i % mainGridLineEveryN === 0) {
                    ctxMain.lineWidth = lineWidthBig
                    ctxMain.moveTo(topOfGridHorizontal, (store.imageHeight - i) * store.scale.current * 16 + store.offset.y)
                    ctxMain.lineTo(bottomOfGridHorizontal, (store.imageHeight - i) * store.scale.current * 16 + store.offset.y)
                } else {
                    ctxMain.lineWidth = lineWidthSmall
                    ctxMain.moveTo(topOfGridHorizontal, (store.imageHeight - i) * store.scale.current * 16 + store.offset.y + 0.5)
                    ctxMain.lineTo(bottomOfGridHorizontal, (store.imageHeight - i) * store.scale.current * 16 + store.offset.y + 0.5)
                }
                ctxMain.stroke()
            }

            for (let i = startOfRenderGridVertical; i <= endOfRenderGridVertical; i += 1) {
                ctxMain.beginPath()
                if (i % mainGridLineEveryN === 0) {
                    ctxMain.lineWidth = lineWidthBig
                    ctxMain.moveTo(i * store.scale.current * 16 + store.offset.x, topOfGridVertical)
                    ctxMain.lineTo(i * store.scale.current * 16 + store.offset.x, bottomOfGridVertical)
                } else {
                    ctxMain.lineWidth = lineWidthSmall
                    ctxMain.moveTo(i * store.scale.current * 16 + store.offset.x, topOfGridVertical + 0.5)
                    ctxMain.lineTo(i * store.scale.current * 16 + store.offset.x, bottomOfGridVertical + 0.5)
                }
                ctxMain.stroke()
            }
        }

        function renderPainted() {
            for (let x in store.layers.paintedImage) {
                for (let y in store.layers.paintedImage[x]) {
                    let xInt = parseInt(x.replace(/[xy]/, ''))
                    let yInt = parseInt(y.replace(/[xy]/, ''))
                    let imageForCanvas = store.getBlockById(store.layers.paintedImage[x][y]).image
                    ctxMain.drawImage(imageForCanvas,
                                      xInt * store.baseCellSize * store.scale.current + store.offset.x, 
                                      yInt * store.baseCellSize * store.scale.current + store.offset.y, 
                                      store.scale.current * store.baseCellSize, 
                                      store.scale.current * store.baseCellSize)
                }
            }
        }

        function renderByLoop() {
            const visibleCorners = thisRoot._getCornersOfVisible()
            const topLeftX = visibleCorners.topLeftX
            const topLeftY = visibleCorners.topLeftY
            const bottomRightX = visibleCorners.bottomRightX
            const bottomRightY = visibleCorners.bottomRightY

            ctxMain.clearRect(0, 0, store.canvasWidth, store.canvasHeight)
            for (let y = topLeftY; y <= bottomRightY; y++) {
                for (let x = topLeftX; x <= bottomRightX; x++) {
                    if (x < store.imageWidth && y < store.imageHeight) {
                        let hexBlock = store.imageConvertedHex[y * store.imageWidth + x]
                        let imageForCanvas = store.getBlockById(parseInt(hexBlock, 16)).image
                        ctxMain.drawImage(imageForCanvas, 
                                          x * store.baseCellSize * store.scale.current + store.offset.x,
                                          y * store.baseCellSize * store.scale.current + store.offset.y,
                                          store.scale.current * store.baseCellSize,
                                          store.scale.current * store.baseCellSize)
                    }
                }
            }
        }

        function renderByCache() {
            ctxMain.drawImage(store.layers.loadedImage, 
                              store.offset.x, 
                              store.offset.y, 
                              store.imageWidth * 16 * store.scale.current, 
                              store.imageHeight * 16 * store.scale.current)
        }

        var t0 = performance.now()
        ctxMain.clearRect(0, 0, store.canvasWidth, store.canvasHeight)
        if (store.scale.current > store.scale.cacheFrom) {
            renderByLoop()
            renderPainted()
        } else {
            renderByCache()
            renderPainted()
        }
        // renderGrid()
        renderRulerLines()
        store.debug.renderTime[store.scale.current] = (performance.now() - t0 + store.debug.renderTime[store.scale.current]) / 2
        document.querySelector('#render-time').innerHTML = `
            Scale: ${store.scale.current} || Average: ${Math.round(store.debug.renderTime[store.scale.current] * 1000) / 1000} ms
        `
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
        this._setEventListeners()
    }

    this.init()
}

export default MineartCanvas
