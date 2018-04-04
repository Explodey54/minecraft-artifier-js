function MineartCanvas(canvasId) {
    const canvasMain = document.getElementById(canvasId)
    const ctxMain = canvasMain.getContext('2d')

    const canvasOverlay = document.getElementById('canvasOverlay')
    const ctxOverlay = canvasOverlay.getContext('2d')

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
        paintedHexRendered: {},
        paintedHexSaved: {},
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
        controls: {
            mouse: {
                localX: null,
                localY: null,
                grabbed: false,
                leftClick: false,
                startX: 0,
                startY: 0,
                oldOffsetX: null,
                oldOffsetY: null,
                lastMouseX: null,
                lastMouseY: null
            }
        },
        debug: { //delete in prod!!!
            renderAllPainted: false,
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

    this._createMainBlobImage = (str) => {
        canvasTemp.width = store.imageWidth * store.baseCellSize * store.scale.cacheFrom
        canvasTemp.height = store.imageHeight * store.baseCellSize * store.scale.cacheFrom

        ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)

        for (let i = 0; i < store.imageConvertedHex.length; i++) {
            let x = i % store.imageWidth
            let y = Math.floor(i / store.imageWidth)
            let imageForCanvas = store.getBlockById(parseInt(store.imageConvertedHex[i], 16)).image
            ctxTemp.drawImage(imageForCanvas,
                             x * store.baseCellSize * store.scale.cacheFrom,
                             y * store.baseCellSize * store.scale.cacheFrom,
                             store.baseCellSize * store.scale.cacheFrom,
                             store.baseCellSize * store.scale.cacheFrom)
        }

        store.layers.loadedImage = new Image()

        let blob = b64toBlob(canvasTemp.toDataURL().slice(22), 'image/png')
        ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)

        store.layers.loadedImage.src = _URL.createObjectURL(blob)

        store.layers.loadedImage.onload = () => {
            canvasMain.dispatchEvent(store.events.cached)
        }
    }

    this._createPaintedBlobImage = () => {
        let blob = b64toBlob(canvasTemp.toDataURL().slice(22), 'image/png')

        let tempImg = new Image()
        tempImg.src = _URL.createObjectURL(blob)
        for (let i in store.paintedHexRendered) {
            store.paintedHexSaved[i] = store.paintedHexRendered[i]
        }
        store.paintedHexRendered = {}


        tempImg.onload = () => {
            store.layers.paintedImage.key1 = tempImg
            
            thisRoot.render()
        }
    }

    this._fakePaint = (x, y, id) => {
        let imageForCanvas = store.getBlockById(id).image
        ctxMain.drawImage(imageForCanvas,
                          x * store.baseCellSize * store.scale.current + store.offset.x, 
                          y * store.baseCellSize * store.scale.current + store.offset.y, 
                          store.scale.current * store.baseCellSize, 
                          store.scale.current * store.baseCellSize)

        ctxTemp.drawImage(imageForCanvas,
                          x * store.baseCellSize, 
                          y * store.baseCellSize, 
                          store.baseCellSize, 
                          store.baseCellSize)
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
                lastMouseX: null,
                lastMouseY: null
            }
        }

        let tempFakePaintedPoints = {}

        function bresenhamLine(x0, y0, x1, y1) {
            var dx = Math.abs(x1-x0);
            var dy = Math.abs(y1-y0);
            var sx = (x0 < x1) ? 1 : -1;
            var sy = (y0 < y1) ? 1 : -1;
            var err = dx-dy;
            var output = []

            while(true) {
                output.push([x0, y0])
                if ((x0==x1) && (y0==y1)) break;
                var e2 = 2*err;
                if (e2 >-dy){ err -= dy; x0  += sx; }
                if (e2 < dx){ err += dx; y0  += sy; }
            }
            return output
        }

        canvasOverlay.addEventListener('mousemove', function(e) {
            store.controls.mouse.localX = e.pageX - store.boundingRect.x - store.controls.mouse.startX
            store.controls.mouse.localY = e.pageY - store.boundingRect.y - store.controls.mouse.startY
            if (store.controls.mouse.grabbed) {
                store.offset.translate(store.controls.mouse.localX + store.controls.mouse.oldOffsetX, store.controls.mouse.localY + store.controls.mouse.oldOffsetY)
                thisRoot.render()
            }
            if (store.controls.mouse.leftClick && thisRoot.getTool() === 'clicker') {
                let xBlock = (Math.floor((store.controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
                let yBlock = (Math.floor((store.controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))
                let paintedLinePoints = bresenhamLine(store.controls.mouse.lastMouseX, store.controls.mouse.lastMouseY, xBlock, yBlock)
                
                for (let i in paintedLinePoints) {
                    let xBlock = paintedLinePoints[i][0]
                    let yBlock = paintedLinePoints[i][1]
                    thisRoot._fakePaint(xBlock, yBlock, thisRoot.getEyedrop())
                    tempFakePaintedPoints[yBlock * store.imageWidth + xBlock] = {
                        x: xBlock,
                        y: yBlock,
                        id: thisRoot.getEyedrop()
                    }
                }

                store.controls.mouse.lastMouseX = xBlock
                store.controls.mouse.lastMouseY = yBlock
            }
        })

        canvasOverlay.addEventListener('mousedown', function(e) {
            if (e.which === 1) {

                let xBlock = (Math.floor((store.controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
                let yBlock = (Math.floor((store.controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))
                store.controls.mouse.lastMouseX = xBlock
                store.controls.mouse.lastMouseY = yBlock
                store.controls.mouse.leftClick = true
                if (thisRoot.getTool() === 'eyedropper') {
                    let id = thisRoot._getBlockIdByPosition(xBlock, yBlock)
                    thisRoot.setEyedrop(id)
                }  
            }
            if (e.which === 2) {
                e.preventDefault()
                store.controls.mouse.grabbed = true
                store.controls.mouse.startX = e.clientX - store.boundingRect.x
                store.controls.mouse.startY = e.clientY - store.boundingRect.y
                store.controls.mouse.oldOffsetX = store.offset.x
                store.controls.mouse.oldOffsetY = store.offset.y
            }
        })

        document.addEventListener('mouseup', function(e) {
            store.controls.mouse.grabbed = false
            store.controls.mouse.leftClick = false
            store.controls.mouse.startX = 0
            store.controls.mouse.startY = 0
            for (let i in tempFakePaintedPoints) {
                thisRoot.paint(tempFakePaintedPoints[i].x, tempFakePaintedPoints[i].y, tempFakePaintedPoints[i].id)
            }
            // console.log(Object.keys(store.paintedHexRendered).length)
            if (Object.keys(store.paintedHexRendered).length > 1000) {
                console.log('renderingrenderer')
                thisRoot._createPaintedBlobImage()
            }
            tempFakePaintedPoints = {}
        })

        canvasOverlay.addEventListener("wheel", (e) => {
            e.preventDefault()
            if (e.deltaY < 0) {
                if (store.scale.scaleUp()) {
                    let x = Math.floor(store.controls.mouse.localX - store.offset.x)
                    let y = Math.floor(store.controls.mouse.localY - store.offset.y)
                    store.offset.translate(store.offset.x - x, store.offset.y - y)
                    thisRoot.render()
                }
            }

            if (e.deltaY > 0) {
                if (store.scale.scaleDown()) {
                    let x = Math.floor(store.controls.mouse.localX - store.offset.x)
                    let y = Math.floor(store.controls.mouse.localY - store.offset.y)
                    store.offset.translate(store.offset.x + x / 2, store.offset.y + y / 2)
                    thisRoot.render()
                }
            }
        })
    }

    this.debugRenderAllPainted = () => {
        store.debug.renderAllPainted = !store.debug.renderAllPainted
        return store.debug.renderAllPainted
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
        this._createMainBlobImage(arr)
    }

    this.setEyedrop = (id) => {
        store.interface.eyedropCurrent = id
    }

    this.getEyedrop = () => {
        return store.interface.eyedropCurrent
    }

    this.paint = (x, y, id) => {
        if (!id) { return }
        store.paintedHexRendered[y * store.imageWidth + x] = id
    }

    this.render = function() {
        function renderRulers() {
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
            if (store.debug.renderAllPainted) {
                for (let i in store.paintedHexSaved) {
                    let x = i % store.imageWidth
                    let y = Math.floor(i / store.imageWidth)
                    let imageForCanvas = store.getBlockById(store.paintedHexSaved[i]).image
                    ctxMain.drawImage(imageForCanvas,
                                      x * store.baseCellSize * store.scale.current + store.offset.x, 
                                      y * store.baseCellSize * store.scale.current + store.offset.y, 
                                      store.scale.current * store.baseCellSize, 
                                      store.scale.current * store.baseCellSize)
                }
                return
            }

            if (store.layers.paintedImage.key1) {
                ctxMain.drawImage(store.layers.paintedImage.key1, 
                                  store.offset.x, 
                                  store.offset.y, 
                                  store.imageWidth * 16 * store.scale.current, 
                                  store.imageHeight * 16 * store.scale.current)
            }

            for (let i in store.paintedHexRendered) {
                let x = i % store.imageWidth
                let y = Math.floor(i / store.imageWidth)
                let imageForCanvas = store.getBlockById(store.paintedHexRendered[i]).image
                ctxMain.drawImage(imageForCanvas,
                                  x * store.baseCellSize * store.scale.current + store.offset.x, 
                                  y * store.baseCellSize * store.scale.current + store.offset.y, 
                                  store.scale.current * store.baseCellSize, 
                                  store.scale.current * store.baseCellSize)
            }
        }

        function renderMain() {
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

            if (store.scale.current > store.scale.cacheFrom) {
                renderByLoop()
            } else {
                renderByCache()
            }
        }
        

        const renderList = {
            'RENDER_MAIN': renderMain,
            'RENDER_PAINTED': renderPainted,
            'RENDER_RULERS': renderRulers,
            'RENDER_GRID': renderGrid
        }

        function renderHelper(list) {
            for (let key in list) {
                if (renderList[list[key]]) { renderList[list[key]]() }
            }
        }

        var t0 = performance.now()
        ctxMain.clearRect(0, 0, store.canvasWidth, store.canvasHeight)

        renderHelper([
            'RENDER_MAIN',
            'RENDER_PAINTED',
            // 'RENDER_GRID',
            'RENDER_RULERS'
        ])
        
        store.debug.renderTime[store.scale.current] = (performance.now() - t0 + store.debug.renderTime[store.scale.current]) / 2
        document.querySelector('#render-time').innerHTML = `
            Scale: ${store.scale.current} || Average: ${Math.round(store.debug.renderTime[store.scale.current] * 1000) / 1000} ms
        `
    }

    this.init = function() {
        canvasMain.width = store.canvasWidth
        canvasMain.height = store.canvasHeight
        canvasOverlay.width = store.canvasWidth
        canvasOverlay.height = store.canvasHeight
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
