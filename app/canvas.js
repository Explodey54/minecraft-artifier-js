function MineartCanvas(canvasId) {
    const canvasMain = document.getElementById(canvasId)
    const ctxMain = canvasMain.getContext('2d')

    const canvasOverlay = document.getElementById('canvasOverlay')
    const ctxOverlay = canvasOverlay.getContext('2d')

    const canvasTemp = document.createElement('canvas')
    const ctxTemp = canvasTemp.getContext('2d')

    const canvasPainted = document.createElement('canvas')
    const canvasErased = document.createElement('canvas')

    const _URL = window.URL || window.webkitURL
    const b64toBlob = require('b64-to-blob')

    const thisRoot = this

    const store = {
        blocksDb: require('../static/baked_blocks.json'),
        getBlockById(id) { return this.blocksDb[id - 1] },
        imageConvertedHex: null,
        renderedPainted: {},
        imageWidth: null,
        imageHeight: null,
        canvasWidth: 1000,
        canvasHeight: 700,
        baseCellSize: 16,
        boundingRect: null,
        layers: {
            loadedImage: null,
            paintedCtx: canvasPainted.getContext('2d'),
            erasedCtx: canvasErased.getContext('2d')
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
        history: {
            log: [],
            currentPos: -1,
            lastMaxPos: -1
        },
        interface: {
            eyedropCurrent: 44,
            toolCurrent: 'clicker',
            brushSize: 1,
            brushType: 'circle',
            selection: {
                start: null,
                end: null
            }
        },
        events: {
            cached: new CustomEvent('cached'),
            history: new CustomEvent('history')
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
        settings: {
            maxBrushSize: 25
        },
        debug: { //delete in prod!!!
            showTempCanvas: false,
            renderAllPainted: false,
            renderTime: {
                '0.125': 0,
                '0.25': 0,
                '0.5': 0,
                '1': 0,
                '2': 0,
                '4': 0
            },
            savedStartHistory: null
        }
    }

    /* DEBUG */
    /////////////////////

    this._debugSaveHistory = () => {
        let history = {
            cachedPainted: store.history.cachedPainted,
            log: store.history.log
        }
        store.debug.savedStartHistory = JSON.parse(JSON.stringify(history))
    }

    this._debugCompareHistory = () => {
        var deepEqual = require('deep-equal')
        let history = {
            cachedPainted: store.history.cachedPainted,
            log: store.history.log
        }
        history = JSON.parse(JSON.stringify(history))
        return deepEqual(store.debug.savedStartHistory, history)
    }

    this._debugReturnStore = () => {
        return store
    }

    this._isEmptyObject = (obj) => {
        for (let key in obj) {
            return false;
        }
        return true;
    }

    /* PRIVATE METHODS */
    //////////////////////////////////////

    this._getPosFromInt = (int) => {
        return {
            x: int % store.imageWidth,
            y: Math.floor(int / store.imageWidth)
        }
    }

    this._getIntFromPos = (x, y) => {
        return y * store.imageWidth + x
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

        return store.imageConvertedHex[y * store.imageWidth + x]
    }

    this._checkIfInSelection = (int) => {
        if (store.interface.selection.start === null || store.interface.selection.start === null) { return NaN }
        let tempStart, tempEnd
        if (store.interface.selection.start < store.interface.selection.end) {
            tempStart = store.interface.selection.start
            tempEnd = store.interface.selection.end
        } else {
            tempStart = store.interface.selection.end
            tempEnd = store.interface.selection.start
        }
        if (int < tempStart || int > tempEnd) { return false }
        let startModulo = tempStart % store.imageWidth
        let endModulo = tempEnd % store.imageWidth
        let intModulo = int % store.imageWidth
        if (intModulo < startModulo || intModulo > endModulo) { return false }
        return true
    }

    this._createMainBlobImage = (str) => {
        canvasTemp.width = store.imageWidth * store.baseCellSize * store.scale.cacheFrom
        canvasTemp.height = store.imageHeight * store.baseCellSize * store.scale.cacheFrom

        ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)

        for (let i = 0; i < store.imageConvertedHex.length; i++) {
            let x = i % store.imageWidth
            let y = Math.floor(i / store.imageWidth)
            let imageForCanvas = store.getBlockById(store.imageConvertedHex[i]).image
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

    this._fakePaint = (x, y, id) => {
        if (x < 0 || x >= store.imageWidth ) { return }
        if (y < 0 || y >= store.imageHeight ) { return }

        let imageForCanvas = store.getBlockById(id).image
        ctxMain.drawImage(imageForCanvas,
                          x * store.baseCellSize * store.scale.current + store.offset.x, 
                          y * store.baseCellSize * store.scale.current + store.offset.y, 
                          store.scale.current * store.baseCellSize, 
                          store.scale.current * store.baseCellSize)

        store.layers.paintedCtx.drawImage(imageForCanvas,
                          x * store.baseCellSize, 
                          y * store.baseCellSize, 
                          store.baseCellSize, 
                          store.baseCellSize)

        store.layers.erasedCtx.clearRect(
                          x * store.baseCellSize, 
                          y * store.baseCellSize, 
                          store.baseCellSize, 
                          store.baseCellSize)
    }

    this._fakeErase = (x, y) => {
        if (x < 0 || x >= store.imageWidth ) { return }
        if (y < 0 || y >= store.imageHeight ) { return }

        ctxMain.clearRect(x * store.baseCellSize * store.scale.current + store.offset.x, 
                          y * store.baseCellSize * store.scale.current + store.offset.y, 
                          store.scale.current * store.baseCellSize, 
                          store.scale.current * store.baseCellSize)

        store.layers.erasedCtx.fillStyle = "black"
        store.layers.erasedCtx.fillRect(
                          x * store.baseCellSize, 
                          y * store.baseCellSize, 
                          store.baseCellSize, 
                          store.baseCellSize)
    }

    this._addToHistory = (type, data) => {
        store.history.currentPos++

        for (let i = store.history.currentPos; i <= store.history.lastMaxPos; i++) {
            delete store.history.log[i]
        }

        store.history.lastMaxPos = store.history.currentPos
        store.history.log[store.history.currentPos] = {
            type: type,
            data: data
        }
        const event = store.events.history
        event.details = {
            pos: store.history.currentPos,
            type: store.history.log[store.history.currentPos].type
        }
        canvasMain.dispatchEvent(event)
    }

    this._undoBack = (pos) => {
        for (let i = store.history.currentPos; i > pos; i += -1) {
            const logStep = store.history.log[i]
            for (let key in logStep.data.before) {
                let xBlock = key % store.imageWidth
                let yBlock = Math.floor(key / store.imageWidth)
                if (logStep.data.before[key] === undefined) {
                    delete store.renderedPainted[key]
                    store.layers.paintedCtx.clearRect(
                        xBlock * store.baseCellSize, 
                        yBlock * store.baseCellSize, 
                        store.baseCellSize, 
                        store.baseCellSize)
                    store.layers.erasedCtx.clearRect(
                              xBlock * store.baseCellSize, 
                              yBlock * store.baseCellSize, 
                              store.baseCellSize, 
                              store.baseCellSize)
                } else {
                    if (logStep.data.before[key] === 0) {
                        store.layers.erasedCtx.fillStyle = "black"
                        store.layers.erasedCtx.fillRect(
                                  xBlock * store.baseCellSize, 
                                  yBlock * store.baseCellSize, 
                                  store.baseCellSize, 
                                  store.baseCellSize)
                    } else {
                        let imageForCanvas = store.getBlockById(logStep.data.before[key]).image
                        store.layers.paintedCtx.drawImage(imageForCanvas,
                              xBlock * store.baseCellSize, 
                              yBlock * store.baseCellSize, 
                              store.baseCellSize, 
                              store.baseCellSize)
                        store.layers.erasedCtx.clearRect(
                              xBlock * store.baseCellSize, 
                              yBlock * store.baseCellSize, 
                              store.baseCellSize, 
                              store.baseCellSize)
                    }
                    store.renderedPainted[key] = logStep.data.before[key]
                }
            }
        }
    }

    this._undoForward = (pos) => {
        for (let i = store.history.currentPos; i <= pos; i++) {
            if (i === -1) { continue }
            const logStep = store.history.log[i]
            for (let key in logStep.data.current) {
                let xBlock = key % store.imageWidth
                let yBlock = Math.floor(key / store.imageWidth)
                if (logStep.data.current[key] === undefined) {
                    delete store.renderedPainted[key]
                    store.layers.paintedCtx.clearRect(
                        xBlock * store.baseCellSize, 
                        yBlock * store.baseCellSize, 
                        store.baseCellSize, 
                        store.baseCellSize)
                } else {
                    if (logStep.data.current[key] === 0) {
                        store.layers.erasedCtx.fillStyle = "black"
                        store.layers.erasedCtx.fillRect(
                                  xBlock * store.baseCellSize, 
                                  yBlock * store.baseCellSize, 
                                  store.baseCellSize, 
                                  store.baseCellSize)
                    } else {
                        let imageForCanvas = store.getBlockById(logStep.data.current[key]).image
                        store.layers.paintedCtx.drawImage(imageForCanvas,
                              xBlock * store.baseCellSize, 
                              yBlock * store.baseCellSize, 
                              store.baseCellSize, 
                              store.baseCellSize)
                        store.layers.erasedCtx.clearRect(
                              xBlock * store.baseCellSize, 
                              yBlock * store.baseCellSize, 
                              store.baseCellSize, 
                              store.baseCellSize)
                    }
                    store.renderedPainted[key] = logStep.data.current[key]
                }       
            }
        }
    }

    this._undoTo = (pos) => {
        pos = parseInt(pos)
        if (pos === store.history.currentPos) { return }

        if (pos === -1) {
            store.renderedPainted = {}
            store.layers.paintedCtx.clearRect(0, 0, canvasPainted.width, canvasPainted.height)
            store.layers.erasedCtx.clearRect(0, 0, canvasErased.width, canvasErased.height)
        } else {
            if (store.history.currentPos - pos > 0) {
                this._undoBack(pos)
            } else {
                this._undoForward(pos)
            }
        }

        store.history.currentPos = pos

        this._renderMainCanvas()
    }

    this._setEventListeners = function() {
        let tempFakePaintedPoints = {}

        function bresenhamLine(x0, y0, x1, y1, skipEveryN, callback) {
            var dx = Math.abs(x1-x0);
            var dy = Math.abs(y1-y0);
            var sx = (x0 < x1) ? 1 : -1;
            var sy = (y0 < y1) ? 1 : -1;
            var err = dx-dy;
            let i = 0

            while(true) {
                if ((x0==x1) && (y0==y1)) break;
                var e2 = 2*err;
                if (e2 >-dy){ err -= dy; x0  += sx; }
                if (e2 < dx){ err += dx; y0  += sy; }
                if (i % skipEveryN === 0) {
                    callback(x0, y0)
                }
                i++
            }
        }

        function draw(x, y) {
            let size = store.interface.brushSize % 2 === 0 ? store.interface.brushSize + 1 : store.interface.brushSize
            let radius = Math.floor(size / 2)
            let totalBlocks = Math.pow(size, 2)
            let startPointX = x - radius
            let startPointY = y - radius
            const maxWidthForRow = {}

            if (store.interface.brushType === 'circle') {
                const PIPortion = 0.5 / (radius + 1)
                for (let i = 1; i <= radius; i ++) {
                    maxWidthForRow[i] = Math.round(Math.cos(i * PIPortion * Math.PI) * store.interface.brushSize / 2)
                }
            }

            for (let i = 0; i < totalBlocks; i++) {
                let xBlock = startPointX + (i % size)
                let yBlock = startPointY + Math.floor(i / size)
                if (xBlock < 0 || xBlock >= store.imageWidth || yBlock < 0 || yBlock >= store.imageHeight) { continue }

                if (store.interface.selection.start !== null) {
                    if (!thisRoot._checkIfInSelection(thisRoot._getIntFromPos(xBlock,yBlock))) { continue }
                }
                
                if (thisRoot.getTool() === 'eraser') {
                    thisRoot._fakeErase(xBlock, yBlock)
                    tempFakePaintedPoints[yBlock * store.imageWidth + xBlock] = 0
                } else {
                    if (store.interface.brushType === 'circle') {
                        let tempMaxRow = maxWidthForRow[Math.abs(Math.floor(i / size) - radius)]
                        if (tempMaxRow < Math.abs(i % size - radius)) { continue }
                    }
                    thisRoot._fakePaint(xBlock, yBlock, thisRoot.getEyedrop())
                    tempFakePaintedPoints[yBlock * store.imageWidth + xBlock] = thisRoot.getEyedrop()
                }
            }
        }

        canvasOverlay.addEventListener('mousemove', function(e) {
            store.controls.mouse.localX = Math.round(e.pageX - store.boundingRect.x - store.controls.mouse.startX)
            store.controls.mouse.localY = Math.round(e.pageY - store.boundingRect.y - store.controls.mouse.startY)
            let xBlock = (Math.floor((store.controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
            let yBlock = (Math.floor((store.controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))

            if (store.controls.mouse.grabbed) {
                store.offset.translate(store.controls.mouse.localX + store.controls.mouse.oldOffsetX, store.controls.mouse.localY + store.controls.mouse.oldOffsetY)
                thisRoot._renderMainCanvas()
                thisRoot._renderOverlayCanvas()
            }
            if (store.controls.mouse.leftClick && (thisRoot.getTool() === 'clicker' || thisRoot.getTool() === 'eraser')) {
                if (xBlock < 0 || xBlock >= store.imageWidth ) { return }
                if (yBlock < 0 || yBlock >= store.imageHeight ) { return }

                //start the bresenham algorithm with the callback
                const skipEveryN = Math.ceil(store.interface.brushSize / 4)
                bresenhamLine(store.controls.mouse.lastMouseX, store.controls.mouse.lastMouseY, xBlock, yBlock, skipEveryN, draw)

                store.controls.mouse.lastMouseX = xBlock
                store.controls.mouse.lastMouseY = yBlock
            }
            if (store.controls.mouse.leftClick && thisRoot.getTool() === 'selection') {
                let tempX = xBlock
                let tempY = yBlock

                if (xBlock < 0) { tempX = 0 }
                if (yBlock < 0) { tempY = 0 }
                if (xBlock >= store.imageWidth ) { tempX = store.imageWidth - 1 }
                if (yBlock >= store.imageHeight ) { tempY = store.imageHeight - 1 }

                store.interface.selection.end = thisRoot._getIntFromPos(tempX, tempY)
            }
            thisRoot._renderOverlayCanvas()
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

                if (thisRoot.getTool() === 'clicker' || thisRoot.getTool() === 'eraser') {
                    draw(xBlock, yBlock)
                }

                if (thisRoot.getTool() === 'selection') {
                    let tempX = xBlock
                    let tempY = yBlock

                    if (xBlock < 0) { tempX = 0 }
                    if (yBlock < 0) { tempY = 0 }
                    if (xBlock >= store.imageWidth ) { tempX = store.imageWidth - 1 }
                    if (yBlock >= store.imageHeight ) { tempY = store.imageHeight - 1 }
                    store.interface.selection.start = thisRoot._getIntFromPos(tempX, tempY)
                    store.interface.selection.end = thisRoot._getIntFromPos(tempX, tempY)
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

            if (!thisRoot._isEmptyObject(tempFakePaintedPoints)) {
                const history = {
                    current: {},
                    before: {}
                }
                for (let i in tempFakePaintedPoints) {
                    history.current[i] = tempFakePaintedPoints[i]
                    history.before[i] = store.renderedPainted[i]
                    store.renderedPainted[i] = tempFakePaintedPoints[i]
                }
                thisRoot._addToHistory(thisRoot.getTool(), history)
                tempFakePaintedPoints = {}
                console.log(Object.keys(store.renderedPainted).length)
            }

            if (store.interface.selection.start === store.interface.selection.end) {
                store.interface.selection.start = null
                store.interface.selection.end = null
                thisRoot._renderOverlayCanvas()
            }
        })

        canvasOverlay.addEventListener("wheel", (e) => {
            e.preventDefault()
            if (e.deltaY < 0) {
                if (store.scale.scaleUp()) {
                    let x = Math.floor(store.controls.mouse.localX - store.offset.x)
                    let y = Math.floor(store.controls.mouse.localY - store.offset.y)
                    store.offset.translate(store.offset.x - x, store.offset.y - y)
                }
            }

            if (e.deltaY > 0) {
                if (store.scale.scaleDown()) {
                    let x = Math.floor(store.controls.mouse.localX - store.offset.x)
                    let y = Math.floor(store.controls.mouse.localY - store.offset.y)
                    store.offset.translate(store.offset.x + x / 2, store.offset.y + y / 2)
                }
            }
            thisRoot._renderMainCanvas()
            thisRoot._renderOverlayCanvas()
        })
    }

    this._renderOverlayCanvas = () => {

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

            ctxOverlay.beginPath()
            ctxOverlay.fillStyle = rulerFillStyle
            ctxOverlay.rect(0, store.canvasHeight - rulerSizeHorizontal, store.canvasWidth, rulerSizeHorizontal)
            ctxOverlay.fill()
            ctxOverlay.rect(0, 0, rulerSizeVertical, store.canvasHeight)
            ctxOverlay.fill()

            ctxOverlay.font = fontStyle;
            ctxOverlay.fillStyle = 'black'
            ctxOverlay.strokeStyle = 'black'
            ctxOverlay.lineWidth = 1
            // gets lastleft/lastright visible n/coordsX and draws everything between them

            for (let i = Math.ceil(-store.offset.x / store.scale.current / 16 / drawRulerEveryNBlocks) * drawRulerEveryNBlocks;
                 i <= Math.floor((-store.offset.x + store.canvasWidth) / store.scale.current / 16 / drawRulerEveryNBlocks) * drawRulerEveryNBlocks; 
                 i += drawRulerEveryNBlocks) {
                ctxOverlay.beginPath()
                ctxOverlay.moveTo(i * store.scale.current * 16 + store.offset.x + 0.5, store.canvasHeight)
                ctxOverlay.lineTo(i * store.scale.current * 16 + store.offset.x + 0.5, store.canvasHeight - rulerSizeHorizontal)
                ctxOverlay.stroke()
                ctxOverlay.fillText(i, i * store.scale.current * 16 + store.offset.x + 2, store.boundingRect.height - 10)
            }

            for (let i = Math.floor((store.offset.y / 16 / store.scale.current + store.imageHeight) / drawRulerEveryNBlocks) * drawRulerEveryNBlocks;
                 i >= Math.floor(((store.offset.y - store.canvasHeight) / 16 / store.scale.current + store.imageHeight) / drawRulerEveryNBlocks) * drawRulerEveryNBlocks; 
                 i -= drawRulerEveryNBlocks) {
                ctxOverlay.beginPath()
                ctxOverlay.moveTo(0, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y + 0.5) // + 0.5 for just the right thickness
                ctxOverlay.lineTo(rulerSizeVertical, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y + 0.5)
                ctxOverlay.stroke()
                ctxOverlay.fillText(i, 1, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y - 3)
            }

            ctxOverlay.rect(0, store.canvasHeight - rulerSizeHorizontal, rulerSizeVertical, rulerSizeHorizontal)
            ctxOverlay.fill()
        }

        function renderBrush() {
            let size = store.interface.brushSize % 2 === 0 ? store.interface.brushSize + 1 : store.interface.brushSize
            let brushSize = size * store.baseCellSize * store.scale.current
            ctxOverlay.strokeStyle = "black 1.5px"
            ctxOverlay.fillStyle = "rgba(0,0,0,0)"
            ctxOverlay.beginPath()
            ctxOverlay.rect(store.controls.mouse.localX - brushSize / 2, store.controls.mouse.localY - brushSize / 2, brushSize, brushSize)
            ctxOverlay.stroke()
        }

        function renderSelection() {
            if (store.interface.selection.start === null || store.interface.selection.end === null) { return }
            if (store.interface.selection.start === store.interface.selection.end) { return }

            var startPos = thisRoot._getPosFromInt(store.interface.selection.start)
            var endPos = thisRoot._getPosFromInt(store.interface.selection.end)

            const tempStart = {
                x: startPos.x <= endPos.x ? startPos.x : endPos.x,  
                y: startPos.y <= endPos.y ? startPos.y : endPos.y
            }

            const tempEnd = {
                x: startPos.x > endPos.x ? startPos.x : endPos.x,  
                y: startPos.y > endPos.y ? startPos.y : endPos.y
            }

            ctxOverlay.rect(tempStart.x * store.baseCellSize * store.scale.current + store.offset.x, 
                            tempStart.y * store.baseCellSize * store.scale.current + store.offset.y,
                            (tempEnd.x - tempStart.x  + 1)  * store.baseCellSize * store.scale.current,
                            (tempEnd.y - tempStart.y + 1) * store.baseCellSize * store.scale.current)
            ctxOverlay.lineWidth = 1
            ctxOverlay.setLineDash([10, 5])
            ctxOverlay.stroke()
        }

        const renderList = {
            'RENDER_BRUSH': renderBrush,
            'RENDER_RULERS': renderRulers,
            'RENDER_SELECTION': renderSelection
        }

        function renderHelper(list) {
            ctxOverlay.clearRect(0, 0, store.canvasWidth, store.canvasHeight)
            ctxOverlay.save()
            for (let key in list) {
                if (renderList[list[key]]) { renderList[list[key]]() }
                ctxOverlay.restore()
            }
        }

        renderHelper([
            'RENDER_SELECTION',
            'RENDER_BRUSH',
            'RENDER_RULERS'
        ])
    }

    this._renderMainCanvas = () => {

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
                for (let i in store.renderedPainted) {
                    let x = i % store.imageWidth
                    let y = Math.floor(i / store.imageWidth)
                    let imageForCanvas = store.getBlockById(store.renderedPainted[i]).image
                    ctxMain.drawImage(imageForCanvas,
                                      x * store.baseCellSize * store.scale.current + store.offset.x, 
                                      y * store.baseCellSize * store.scale.current + store.offset.y, 
                                      store.scale.current * store.baseCellSize, 
                                      store.scale.current * store.baseCellSize)
                }
                return
            }

            if (!thisRoot._isEmptyObject(store.renderedPainted)) {
                ctxMain.drawImage(canvasPainted, 
                          store.offset.x, 
                          store.offset.y, 
                          store.imageWidth * 16 * store.scale.current, 
                          store.imageHeight * 16 * store.scale.current)
            }
        }

        function renderErased() {
            if (!thisRoot._isEmptyObject(store.renderedPainted)) {
                ctxMain.globalCompositeOperation = 'destination-out';
                ctxMain.drawImage(canvasErased,
                              store.offset.x, 
                              store.offset.y, 
                              store.imageWidth * 16 * store.scale.current, 
                              store.imageHeight * 16 * store.scale.current)
                ctxMain.globalCompositeOperation = 'source-over';
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
                            let imageForCanvas = store.getBlockById(hexBlock).image
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
            'RENDER_ERASED': renderErased,
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
            'RENDER_ERASED'
        ])
        
        store.debug.renderTime[store.scale.current] = (performance.now() - t0 + store.debug.renderTime[store.scale.current]) / 2
        document.querySelector('#render-time').innerHTML = `
            Scale: ${store.scale.current} || Average: ${Math.round(store.debug.renderTime[store.scale.current] * 1000) / 1000} ms
        `
    }

    /* PUBLIC METHODS */
    //////////////////////////////////////

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
        canvasPainted.width = store.imageWidth * 16
        canvasPainted.height = store.imageHeight * 16
        canvasErased.width = store.imageWidth * 16
        canvasErased.height = store.imageHeight * 16
        store.layers.paintedCtx.clearRect(0, 0, canvasPainted.width, canvasPainted.height)
        store.layers.erasedCtx.clearRect(0, 0, canvasErased.width, canvasErased.height)
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

    this.addToBrushSize = (int) => {
        let temp = store.interface.brushSize + int
        if (temp < 1) {
            store.interface.brushSize = 1 
        } else if(temp > store.settings.maxBrushSize) {
            store.interface.brushSize = store.settings.maxBrushSize
        } else {
            store.interface.brushSize = temp
        }
        console.log(store.interface.brushSize)
        this._renderOverlayCanvas()      
    }

    this.undoOnce = () => {
        this._undoTo(store.history.currentPos - 1)
    }

    this.undoTo = (pos) => {
        this._undoTo(pos)
    }

    this.getCurrentHistoryPos = () => {
        return store.history.currentPos
    }

    this.replace = (target, replace) => {
        let startBlock = store.interface.selection.start === null ? 0 : store.interface.selection.start
        let endBlock = store.interface.selection.end === null ? store.imageConvertedHex.length - 1 : store.interface.selection.end

        const history = {
            current: {},
            before: {}
        }
        for (let i = startBlock; i <= endBlock; i++) {
            if (store.renderedPainted[i] !== undefined && store.renderedPainted[i] !== target) { continue }

            if (store.interface.selection.start !== null && store.interface.selection.end !== null) {
                if (!this._checkIfInSelection(i)) { continue }
            }

            if (store.renderedPainted[i] === target || store.imageConvertedHex[i] === target) {
                let xBlock = i % store.imageWidth
                let yBlock = Math.floor(i / store.imageWidth)
                history.before[i] = store.renderedPainted[i]
                history.current[i] = replace
                store.renderedPainted[i] = replace
                thisRoot._fakePaint(xBlock, yBlock, replace)
            }
        }

        this._addToHistory('replace', history)
        this.render()
    }

    this.render = () => {
        this._renderMainCanvas()
        this._renderOverlayCanvas()
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
        if (store.debug.showTempCanvas) {
            document.body.appendChild(canvasTemp)
        }
    }

    this.init()
}

export default MineartCanvas
