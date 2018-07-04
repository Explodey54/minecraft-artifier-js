function MineartCanvas(rootNode, width, height) {
    const $root = rootNode

    const canvasMain = document.createElement('canvas')
    const ctxMain = canvasMain.getContext('2d')

    const canvasOverlay = document.createElement('canvas')
    const ctxOverlay = canvasOverlay.getContext('2d')

    const canvasTemp = document.createElement('canvas')
    const ctxTemp = canvasTemp.getContext('2d')

    const _URL = window.URL || window.webkitURL

    const thisRoot = this

    const store = {
        blocksDb: [],
        getBlockById(id) { return this.blocksDb[id - 1] },
        imageConvertedHex: null,
        renderedPainted: {},
        imageWidth: null,
        imageHeight: null,
        canvasWidth: width,
        canvasHeight: height,
        baseCellSize: 16,
        boundingRect: null,
        blobImage: new Image(),
        offset: {
            bounds: {
                x: 600,
                y: 500
            },
            x: 0,
            y: 0,
            translate(x, y) {
                let imageSizeX = store.imageWidth * store.baseCellSize * store.scale.current
                let imageSizeY = store.imageHeight * store.baseCellSize * store.scale.current
                if (x > this.bounds.x) { x = this.bounds.x }
                if (y > this.bounds.y) { y = this.bounds.y }
                if (x + imageSizeX - store.canvasWidth < -this.bounds.x) {
                    x = -imageSizeX + store.canvasWidth - this.bounds.x
                }
                if (y + imageSizeY - store.canvasHeight < -this.bounds.y) {
                    y = -imageSizeY + store.canvasHeight - this.bounds.y
                }
                this.x = Math.round(x)
                this.y = Math.round(y)
            }
        },
        scale: {
            current: 0.0625,
            options: [0.0625, 0.125, 0.25, 0.5, 1, 2, 4],
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
            toolCurrent: 'pencil',
            brushSize: 9,
            selection: {
                start: null,
                end: null
            },
            rulerSize: 25
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
                '0.0625': 0,
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

    this._intToDoubleHex = (int) => {
        const output = int.toString(16)
        if (output.length === 1) {
            return ('0' + output)
        } else {
            return output
        }
    }

    /* PRIVATE METHODS */
    //////////////////////////////////////

    this._checkIfReady = () => {
        if (store.blocksDb.length === 0) { return false }
        // if (store.imageConvertedHex === null) { return false }
        return true
    }

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
        let bottomRightX = Math.floor((store.canvasWidth - store.offset.x) / store.baseCellSize / store.scale.current) + 1
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
        for (let i = 0; i < store.imageConvertedHex.length; i++) {
            let x = i % store.imageWidth
            let y = Math.floor(i / store.imageWidth)
            let imageForCanvas = store.getBlockById(store.imageConvertedHex[i]).image
            ctxTemp.drawImage(imageForCanvas,
                             x * store.baseCellSize,
                             y * store.baseCellSize,
                             store.baseCellSize,
                             store.baseCellSize)
        }

        canvasTemp.toBlob((blob) => {
            store.blobImage.src = _URL.createObjectURL(blob)
        })

        store.blobImage.onload = () => {
            canvasOverlay.dispatchEvent(store.events.cached)
        }
    }

    this._fakePaint = (x, y, id) => {
        if (x < 0 || x >= store.imageWidth ) { return }
        if (y < 0 || y >= store.imageHeight ) { return }

        if (id !== 0) {
            let imageForCanvas = store.getBlockById(id).image

            ctxMain.clearRect(x * store.baseCellSize * store.scale.current + store.offset.x, 
                              y * store.baseCellSize * store.scale.current + store.offset.y, 
                              store.scale.current * store.baseCellSize, 
                              store.scale.current * store.baseCellSize)

            ctxMain.drawImage(imageForCanvas,
                              x * store.baseCellSize * store.scale.current + store.offset.x, 
                              y * store.baseCellSize * store.scale.current + store.offset.y, 
                              store.scale.current * store.baseCellSize, 
                              store.scale.current * store.baseCellSize)

            ctxTemp.clearRect(x * store.baseCellSize, 
                              y * store.baseCellSize, 
                              store.baseCellSize, 
                              store.baseCellSize)

            ctxTemp.drawImage(imageForCanvas,
                              x * store.baseCellSize, 
                              y * store.baseCellSize, 
                              store.baseCellSize, 
                              store.baseCellSize)
        } else {
            ctxMain.clearRect(x * store.baseCellSize * store.scale.current + store.offset.x, 
                              y * store.baseCellSize * store.scale.current + store.offset.y, 
                              store.scale.current * store.baseCellSize, 
                              store.scale.current * store.baseCellSize)

            ctxTemp.clearRect(x * store.baseCellSize, 
                              y * store.baseCellSize, 
                              store.baseCellSize, 
                              store.baseCellSize)
        }

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
        canvasOverlay.dispatchEvent(event)
    }

    this._undoBack = (pos) => {
        for (let i = store.history.currentPos; i > pos; i += -1) {
            const logStep = store.history.log[i]
            for (let key in logStep.data.before) {
                let xBlock = key % store.imageWidth
                let yBlock = Math.floor(key / store.imageWidth)
                if (logStep.data.before[key] === undefined) {
                    delete store.renderedPainted[key]
                    this._fakePaint(xBlock, yBlock, store.imageConvertedHex[key])
                } else {
                    if (logStep.data.before[key] === 0) {
                        this._fakePaint(xBlock, yBlock, 0)
                    } else {
                        this._fakePaint(xBlock, yBlock, logStep.data.before[key])
                        let imageForCanvas = store.getBlockById(logStep.data.before[key]).image
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
                if (logStep.data.current[key] === 0) {
                    this._fakePaint(xBlock, yBlock, 0)
                } else {
                    this._fakePaint(xBlock, yBlock, logStep.data.current[key])
                }
                store.renderedPainted[key] = logStep.data.current[key]     
            }
        }
    }

    this._undoTo = (pos) => {
        pos = parseInt(pos)
        if (pos === store.history.currentPos) { return }

        if (pos === -1) {
            store.renderedPainted = {}
            ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)
            ctxTemp.drawImage(store.blobImage, 0, 0)
            this._renderMainCanvas()
        } else {
            if (store.history.currentPos - pos > 0) {
                this._undoBack(pos)
            } else {
                this._undoForward(pos)
            }
        }

        store.history.currentPos = pos
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

            if (thisRoot.getTool() === 'brush') {
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
                    thisRoot._fakePaint(xBlock, yBlock, 0)
                    tempFakePaintedPoints[yBlock * store.imageWidth + xBlock] = 0
                } else {
                    if (thisRoot.getTool() === 'brush') {
                        let tempMaxRow = maxWidthForRow[Math.abs(Math.floor(i / size) - radius)]
                        if (tempMaxRow < Math.abs(i % size - radius)) { continue }
                    }
                    thisRoot._fakePaint(xBlock, yBlock, thisRoot.getEyedrop())
                    tempFakePaintedPoints[yBlock * store.imageWidth + xBlock] = thisRoot.getEyedrop()
                }
            }
        }

        canvasOverlay.addEventListener('mousemove', function(e) {
            if (!thisRoot._checkIfReady()) { return }
            store.controls.mouse.localX = Math.round(e.pageX - store.boundingRect.x - store.controls.mouse.startX)
            store.controls.mouse.localY = Math.round(e.pageY - store.boundingRect.y - store.controls.mouse.startY)
            let xBlock = (Math.floor((store.controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
            let yBlock = (Math.floor((store.controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))

            if (store.controls.mouse.grabbed) {
                store.offset.translate(store.controls.mouse.localX + store.controls.mouse.oldOffsetX, store.controls.mouse.localY + store.controls.mouse.oldOffsetY)
                thisRoot._renderMainCanvas()
                thisRoot._renderOverlayCanvas()
            }
            if (store.controls.mouse.leftClick && (thisRoot.getTool() === 'pencil' || thisRoot.getTool() === 'eraser' || thisRoot.getTool() === 'brush')) {
                if (xBlock < 0 || xBlock >= store.imageWidth ) { return }
                if (yBlock < 0 || yBlock >= store.imageHeight ) { return }
                // if (store.interface.rulerSize > Math.floor(e.pageX - store.boundingRect.x) ||
                //     store.canvasHeight - store.interface.rulerSize < Math.floor(e.pageY - store.boundingRect.y)) {
                //         return
                // }

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
            if (!thisRoot._checkIfReady()) { return }
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
            if (!thisRoot._checkIfReady()) { return }
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
            if (!thisRoot._checkIfReady()) { return }
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
            let rulerFillStyle = 'white',
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
                case 0.0625:
                    drawRulerEveryNBlocks = 100
                    break
            }

            if (store.imageHeight >= 1000) {
                store.interface.rulerSize = 36
            }

            ctxOverlay.beginPath()
            ctxOverlay.fillStyle = rulerFillStyle
            ctxOverlay.rect(0, store.canvasHeight - store.interface.rulerSize, store.canvasWidth, store.interface.rulerSize)
            ctxOverlay.fill()
            ctxOverlay.rect(0, 0, store.interface.rulerSize, store.canvasHeight)
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
                ctxOverlay.lineTo(i * store.scale.current * 16 + store.offset.x + 0.5, store.canvasHeight - store.interface.rulerSize)
                ctxOverlay.stroke()
                ctxOverlay.fillText(i, i * store.scale.current * 16 + store.offset.x + 2, store.boundingRect.height - 10)
            }

            for (let i = Math.floor((store.offset.y / 16 / store.scale.current + store.imageHeight) / drawRulerEveryNBlocks) * drawRulerEveryNBlocks;
                 i >= Math.floor(((store.offset.y - store.canvasHeight) / 16 / store.scale.current + store.imageHeight) / drawRulerEveryNBlocks) * drawRulerEveryNBlocks; 
                 i -= drawRulerEveryNBlocks) {
                ctxOverlay.beginPath()
                ctxOverlay.moveTo(0, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y + 0.5) // + 0.5 for just the right thickness
                ctxOverlay.lineTo(store.interface.rulerSize, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y + 0.5)
                ctxOverlay.stroke()
                ctxOverlay.fillText(i, 1, (store.imageHeight - i) * 16 * store.scale.current + store.offset.y - 3)
            }

            ctxOverlay.rect(0, store.canvasHeight - store.interface.rulerSize, store.interface.rulerSize, store.interface.rulerSize)
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

        function renderMain() {
            function renderByLoop() {
                const visibleCorners = thisRoot._getCornersOfVisible()
                const topLeftX = visibleCorners.topLeftX
                const topLeftY = visibleCorners.topLeftY
                const bottomRightX = visibleCorners.bottomRightX
                const bottomRightY = visibleCorners.bottomRightY
                let hexBlock

                ctxMain.clearRect(0, 0, store.canvasWidth, store.canvasHeight)
                for (let y = topLeftY; y <= bottomRightY; y++) {
                    for (let x = topLeftX; x <= bottomRightX; x++) {
                        if (x < store.imageWidth && y < store.imageHeight) {
                            if (store.renderedPainted[y * store.imageWidth + x] !== undefined) {
                                hexBlock = store.renderedPainted[y * store.imageWidth + x]
                            } else {
                                hexBlock = store.imageConvertedHex[y * store.imageWidth + x]
                            }
                            if (hexBlock > 0) {
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
            }

            function renderByCache() {
                let visible = thisRoot._getCornersOfVisible()
                let offsetX = store.offset.x > 0 ? store.offset.x : store.offset.x % (16 * store.scale.current)
                let offsetY = store.offset.y > 0 ? store.offset.y : store.offset.y % (16 * store.scale.current)
                ctxMain.drawImage(canvasTemp,
                  visible.topLeftX * 16, 
                  visible.topLeftY * 16, 
                  (visible.bottomRightX - visible.topLeftX) * 16, 
                  (visible.bottomRightY - visible.topLeftY) * 16,
                  offsetX,
                  offsetY,
                  (visible.bottomRightX - visible.topLeftX) * 16 * store.scale.current,
                  (visible.bottomRightY - visible.topLeftY) * 16 * store.scale.current)
            }

            if (store.scale.current > store.scale.cacheFrom) {
                renderByLoop()
            } else {
                renderByCache()
            }
        }
        
        const renderList = {
            'RENDER_MAIN': renderMain,
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
            // 'RENDER_GRID'
        ])
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
        if (store.interface.rulerSize > Math.floor(pageX - store.boundingRect.x) ||
            store.canvasHeight - store.interface.rulerSize < Math.floor(pageY - store.boundingRect.y)) {
            return null
        }
        return {
            x: xBlock + 1,
            y: store.imageHeight - yBlock,
            info: store.getBlockById(this._getBlockIdByPosition(xBlock, yBlock))
        } 
    }

    this.setImageSizes = (w, h) => {
        store.imageWidth = parseInt(w)
        store.imageHeight = parseInt(h)
        canvasTemp.width = store.imageWidth * 16
        canvasTemp.height = store.imageHeight * 16
        ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)
        store.offset.x = store.canvasWidth / 2 - store.imageWidth > 0 ? store.canvasWidth / 2 - store.imageWidth / 2 : 0
        store.offset.y = store.canvasHeight / 2 - store.imageHeight > 0 ? store.canvasHeight / 2 - store.imageHeight / 2 : 0
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

    this.getCanvasLink = () => {
        return canvasOverlay
    }

    this.setBlocks = (blocks) => {
        blocks.forEach((item) => {
            store.blocksDb.push(Object.assign({}, item))
        })
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
        return Object.keys(history.current).length
    }

    this.reset = () => {

    }

    this.open = () => {
        const tempFile = '{"version":"1.0","compression":"none","width":300,"height":300,"data":"1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e909090901e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e90b0a0a0a0b8b8b8307ca8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a87c30b8a028a0a0a0286f901e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e906fa06bb8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a87cb8b8a0a0a0a0a078787878787878787878a0b8b830b8b8a0a02890b01e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e6fa0a8a8a8a8a8a87cb8b8a0a0a078787878787878787878787878787878787878787878787878787878787878787878787878787878a0b8b83030b86b28901e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e9028a0b87ca8a87cb8a0a0787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a07878b830306b781e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e906fb87ca8a830b8a0787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a030a87ca0901e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e6fb8307c30b8a07878787878787878787878787878787878787878787878787878787878787878787878787878a0a0a0a0a0a0a0a078787878787878787878787878787878787878787878a030a8306f1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb0a0b83030b87ca8a8a8b8a0787878787878787878787878787878787878787878787878787878787878787878787878787878a0a0b87ca8a8a8a8a8a8a8a8a8a87cb8b8a07878787878787878787878787878787878a07ca8b8b01e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e90a0b8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8a8b8b8a0a0787878787878787878787878787878787878787878787878a0a0b830a8a8a8a8a8a8a8a8a87ca8a8a8a8a8a8a8a8a8a8a8a8a8a830b8a078787878787878787878787878787830a87ca0901e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e28b8a8a830b8a0a0787878787878787878a0a0b87ca8a8a8a8a8a8b87878787878787878787878787878787878a0b8a8a8a8a830b8b8a0a0a0a07878787878787878787878a0a0a0b8b8a8a8a8a8a8a8a8b8a0787878787878787878787878787830a8a8b8281e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e28a8a8b8a078787878787878787878787878787878787878a0b8a8a8a8a8a8b87878787878787878787878a030a8a87cb8a078787878787878787878787878787878787878787878787878787878a0b87ca8a8a8a8a8b878787878787878787878787878a07ca8a8a8a01e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e28a8a8b878787878787878787878787878787878787878787878787878a0b830a8a87c78787878787878a0b8a87cb8a07878787878787878787878787878787878787878787878a0a0a07878787878787878787878a0b8a8a8a87cb8a07878787878787878787878a0a8a8a8a8a01e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb8a8b87878787878787878787878787878787878787878787878787878787878787830a87c78787878a0307cb87878787878787878787878787878787878787878787878a0a0a0b8b8b8b8b8a0787878787878787878787878a0b8a8a8a8a830b878787878787878787878a03030a8301e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e28a87c78787878787878787878787878787878787878787878787878787878787878787878a0a8a8a078b87ca078787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b87c7cb8a0787878787878787878787878b8a8a8a8a8a87ca07878787878787878787878b8a86f1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e3812381e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb8a8b878787878787878787878787878787878787878787878787878787878787878787878787878b8a8a8a07878787878787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b83030b8787878787878787878787878b8a8a0b8a8a8a8b878787878787878787878b8a8a01e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb13131381e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e901e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e78a8a8787878787878787878787878787878787878787878787878787878787878787878787878787878a0b87878787878787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83030b87878787878787878787878a0b8a078a030a8a8b8787878787878787878a0a8a01e1e1e1e1e1e1e1e1e1e90a01e90286f901e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e38381e1e1e1e1e1e1e1e1e1e0d313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e6f701b5c757330b86f1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1ea0a8b8787878787878787878787878787878787878787878787878787878787878787878787878787878a0a07878787878787878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83030b87878787878787878787878a0a07878a07ca8a8a0787878787878787878a8b81e1e1e1e1e1e1e1eb8a87370701b1073a01e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb13112b1381e1e1e1e1e381231313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e900b08080b355c5ca8a8a86b6f1e1e1e1e1e1e1e1e1e1e1e1eb8a8a078787878787878787878787878787878787878787878787878787878787878787878787878787878a078787878787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878a0787878a0a8a8b87878787878787878a0a8a8901e1e1e1e907ca53a0b1d1d1d1d683aa01e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e31313131310db138b1313131313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e90080b681d1d1d1d1b7519a8a8a86bb01e1e1e1e1e1e1e907ca87878787878787878787878787878787878a0b83030b8a07878787878787878787878787878787878787878787878787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878787878787878787878a8a8b878787878787878787830a8906d6b6b731008080b1d1d1d1d1d1da5281e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e0d3131313131313131313131313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e6d0b1d1d1d1d1d1b101d1d0b3a10a8a8a8281e1e1e67a0a87c787878787878787878787878787878a0b83030b8b8b8b83030b8b8a0787878787878787878787878787878787878787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878787878787878b8a8b87878787878787878786b19100c0b688a0b0e3a1b0b1d1d1d1d2da0671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb131313131313131313131313131310d1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e0b1d1d1d1d1b5c1d1d1d1d1d1d0ba57c7c74381ea0a8b87878787878787878787878787878a0b830b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878787878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787878787878787878787878a07c7c787878787878a00c3a080b1d1d1d1d1d1d1d0b5c3a1d1d1d1bb8671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e6731313131313131313131313131310d1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e0b1d1d1d355c1d1d1d1d1d1d1d1d1d682d5c35a0a0a07878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb878787878787878787878787878787878a0a8b8787878713a0e681d1d1d1d1d1d1d1d1d1d1d5c1b1d1d1bb8671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e0d313131313131313131313131310d1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e381e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e0e1d1d085c1d1d1d1d1d1d1d1d1d1d1d1d1d75a0787878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878787878787878787878787878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878787878787878787878787c7ca018080e1d1d1d1d1d1d1d1d1d1d1d1d1d1d751b8d2db8671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb1313131313131313131313131313112671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e120d1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e3a1d685c0b1d1d1d1d1d1d1d1d1d1d1d6819b87878787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878787878787878787878787878b8a8080b1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d687c081ba0671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e6731313131313131313131313131313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e673131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e351d18081d1d1d1d1d1d1d1d1d1d1d1d10a87878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878787878787878787878787878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878b8a80c1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d08a87c90671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e3831313131313131313131313131313131310d1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e38313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e400b351d1d1d1d1d1d1d1d1d1d1d1d5ca87878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878b8a8081d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d5ca81e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1231313131313131313131313131313131313112381e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb131313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e67281b0b1d1d1d1d1d1d1d1d1d1d1d0ca87878787878787878787878a07878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878a0a8b51d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1ba81e671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb1313131313131313131313131313131313131313131381e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e0d3131313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e676f1b1d1d1d1d1d1d1d1d1d1d1d08a8a0787878787878787878a0b87878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878a07878787878787878787878a0a8081d1d1d1d1d1d1d1d1d1d1d1d1d1d19b01e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e3831313131313131313131313131313131313131310db1671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e84313131313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e67901b1d1d1d1d1d1d1d1d1d1d0ba8b8787878787878787878a07ca078b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878b8a07878787878787878787878b8a80e1d1d1d1d1d1d1d1d1d1d1d1d0b7c67671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e0d313131313131313131313131313131313112b1671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e671e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e383131313131313131b11e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e67671e5a681d1d1d1d1d1d1d1d687330787878787878787878a0b8b878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878a0b8787878787878787878787878b8a80b1d1d1d1d1d1d1d1d1d1d1d0ca89067671e1e1e1e1e1e1e1e1e1e1e1e1e1e1eb1313131313131313131313131313131310d381e1e1e1e671e1e1e1e1e1e1e1e1e1e1e6767671e676767676767676767676767676767676767676767676767676767676767676767671e1e6767676767671e671eb1313131313131313131b11e1e676767676767676767676767676767671e67676767a0081d1d1d1d1d1d1d1d5ca878787878787878787878b830a0a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878787878787878787878787878a078b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878b8a07878787878787878787878787c73681d1d1d1d1d1d1d1d1d8a7cb8a02867676767676767676767676767671e3831313131313131313131313131313131b1b41e1e6767676767676767676767671e67676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767671e0d31313131313131313131b11e6767676767676767676767676767676767676767676f1b1d1d1d1d1d1d1d2da8a0787878787878787878b8b8b8a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878787878787878787878787878a078b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878a07c78787878787878787878787878a8101d1d1d1d1d1d1d1d1d18a87878a0a0676767676767676767676767671e38b1b10404040d040d5b31313131313131011e67676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767671e5b3131313131313131313131b11e67676767676767676767676767676767676767671e751d1d1d1d1d1d0ba8b8787878787878787878b8b8b8a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878a07ca0787878787878787878787878a0a80c1d1d1d1d1d1d1d1d7330787878a0a0676767676767676767676767671e1e1e1e1e1e1e1e1e673131313131310d1e67676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767671e3831313131313131313131313131b11e6767676767676767676767676767676767676767b80b1d1d1d1d1d7530787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878b83078787878787878787878787878b8a80b1d1d1d1d1d1d0ba8a078787878b8b86767676767676767676767676767676767676767671e293131313131b11e67676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767671eb13131313131313131313131313131b11e67676767676767676767676767676767676767a0181d1d1d1d2da8787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878b830a078787878787878787878787878a8191d1d1d1d1d1d1ba8787878787878a8a06767676767676767676767676767676767676767671eb131313131676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767671e0d313131313131313131313131313131b11e6767676767676767676767676767676767671e191d1d1d0ba8a07878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878b8b8b878787878787878787878787878a0a81b1d1d1d1d0ba8b878787878787878a86f6767676767676767676767676767676767676767671e0d31310d1e6767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767671e1231313131313131313131313131313131b11e676767676767676767676767676767676767b87a1d1d1030787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878b8b830a078787878787878787878787878b8a80b1d1d1d5ca87878787878787878b8a81e6767676767676767676767676767676767676767671e1231b11e67676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676701313131313131313131313131313131313131b11e67676767676767676767676767676767676f101d08a8b87878787878787878a030b8b8b83030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878787878787878787878787878a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078b8b8b8b87878787878787878787878787878a87c0b1d0ba830787878787878787878a8a0016767676767676767676767676767676767676767676712386767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767671e2931313131313131313131313131313131313131b11e676767676767676767676767676767676730087c307878787878787878a030b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a0a0787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878a0b8b8b87878787878787878787878787878a0a8750b5ca8a0787878787878787878a0a8a01e67676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767671eb13131313131313131313131313131313131313131b11e676767676767676767676767676767676d73a878787878787878787830b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878a0a07878787878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078a0b8b8b8a0787878787878787878787878787830a81ba8a8787878787878787878787830a8b867676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676712313131313131313131313131313131313131313131b11e6767676767676767676767676767671ea8787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878a0a0787878787878787878787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0a0b8b8b8a0787878787878a07878787878787878a8a8a8a07878787878787878787878a0a8a81e67676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767678431313131313131313131313131313131313131313131b11e6767676767676767676767673867b8b878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787878a0b878787878787878787878787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878b8b8b8b8787878787878a07878787878787878b8a8b87878787878787878787878787830a86f0167676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676738313131313131313131313131313131313131313131313131b167383891b1b1040d0d125b843171a8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a0b87878787878787878787878787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878b8b8b8b8787878787878a0a07878787878787878a8a878787878787878787878787878a0a8b867676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767b1313131313131313131313131313131313131313131313131313131313131313131313131318aa8a07878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787830787878787878787878787878787878a078787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0b8b8b8b8a07878787878a0b87878787878787878b8a8a878787878787878787878787878a8a81e6767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767670d3131313131313131313131313131313131313131313131313131313131313131313131311da87c78787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878b8a0787878787878787878787878787878b8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0b8b8b8b8b878787878a07c3078787878787878787830a830787878787878787878787878a0a8a00167676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767675b31313131313131313131313131313131313131313131313131313131313131313131313170a8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878a0b878787878787878787878787878787878b8a07878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0b8b8b8b8b8a0787878a07ca8a07878787878787878787ca8a0787878787878787878787878a87c6767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767073131313131313131313131313131313131313131313131313131313131313131313131311da8b87878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787c7878787878787878787878787878787878b8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878b8b8a83078787878787878787878a8a8787878787878787878787878b8a89001676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767b13131313131313131313131313131313131313131313131313131313131313131313131316ba8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878b8b87878787878787878787878787878787878b8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878b8b8b830a878787878787878787878a0a830787878787878787878787878a8a0016767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767670d31313131313131313131313131313131313131313131313131313131313131313131311da8a07878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787c787878787878787878787878787878787878b8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0a0b8b8b8b8a8a078787878787878787878b8a8a07878787878787878787878b8a8676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767675b31313131313131313131313131313131313131313131313131313131313131313131316ba8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787830a0787878787878787878787878787878787878b8787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8303078787878787878787878b8b8a8787878787878787878787878a86f38676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767679131313131313131313131313131313131313131313131313131313131313131313131311da8787878787878787878a0b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a07c78787878787878787878787878787878787878b8a07878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8b8b8b8b8b8b87c78787878787878787878a0a07ca078787878787878787878787cb8826767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767910d3131313131313131313131313131313131313131313131313131313131313131313131316ba8787878787878787878b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787830b878787878787878787878787878787878787878b8a078787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878787878a0b8a0a87878787878787878787878a0a81e826767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767910d313131313131313131313131313131313131313131313131313131313131313131313131311da8b87878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a87878787878787878787878787878787878787878b8b8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8303078787878787878787878b878a8a07878787878787878787878a8a038676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767910d31313131313131313131313131313131313131313131313131313131313131313131313131313118a8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878b8b87878787878787878787878787878787878787878b8b8787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c78787878787878787878a078b83078787878787878787878787ca86752676767676767676767676767676767676767676767676767676767676767676767676767676767676767526767676767676767676767676767676767676767676767676767676767911231313131313131313131313131313131313131313131313131313131313131313131313131313131317ca87878787878787878b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878787878787ca07878787878787878787878787878787878787878a0a8787878787878787878a030b8b8b8b8b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878787878a0a87878787878787878787878a0a86d386767676767676767676767676767676767676767676767676767676767676767676767675252525252525252526752526752675252525252525267525267676752525252676791123131313131313131313131313131313131313131313131313131313131313131313131313131313131311da8b8787878787878787830b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb87878787878787878787878a878787878787878787878787878787878787878787878a8a0787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878787878787878a8b87878787878787878787878a8a03867526752525252525252526752675252525252525267525252675252525252525252525252525252525252525252525252525252525252528252525252525252525267679112313131313131313131313131313131313131313131313131313131313131313131313131313131313131313108a8a078787878787878a0b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb87878787878787878787878b83078787878787878787878787878787878787878787878a8b8787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878787878b8a878787878787878787878787ca86782525252525252525252525252525252525252525252525252525252525252525252525282828282528282828282828282828282828282828282828282828282676791123131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313171a8787878a0a0787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878787878787878b8b878787878787878787878787878787878787878787878407c78787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878a87878787878787878787878a0a89083828282528282828282828282828282828282828282828282828252828282828282828282828282828282828282828282828282828282828282828282826767911231313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313173a8787878a0787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878787878787878787830a0787878787878787878787878787878787878787878a064597c787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878a8b878787878787878787878a0a86b38828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828267679112313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131311da830787878b8787878b8b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787878787878787878787ca0787878787878787878787878787878787878787878a0121273a0787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878787878b8a8787878787878787878787830a867828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282676791123131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131318aa8b87878a0b8787878b8b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8a078787878787878787878787878787830a07878787878787878787878787878787878787878a0591284157c7878787878787878787830b8b8b8b8b8b8b8b8b8b8b878a0307cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878787878787878a8a078787878787878787878b8a86f8382828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828267679112313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313118a8a07878a07c7878a030b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878b8a07878787878787878787878787878787878787878a00284121240b8787878787878787878a030b8b8b8b8b8b8b8b8b830a07878b83030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878787878787878a8b878787878787878787878a0a8b88282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828291123131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313175a8787878b8307878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0b8b8b8b8b8b8b8b87878787878a0a078787878787878787878b8b87878787878787878787878787878787878787878b80d121212647c78787878787878787878a0b8b8b8b8b8b8b8b8b8b8b878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878787878787878b8a8787878787878787878787830a86783828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282673e31313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131318da8a8787878b8307878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078b8b8b8b8b8b830a07878787878b87878787878787878787878b8307878787878787878787878787878787878787878a06412121284957c78787878787878787878b8b8b8b8b8b8b8b8b8b830a07878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878a0a87878787878787878787878b8a86f8382828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282833e313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131311da830787878b8b878a0b8b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b830b878a030b8b8b8b830b8787878787878b8787878787878787878787840b87878787878787878787878787878787878787878a06412121212126bb878787878787878787878b830b8b8b8b8b8b8b8b8b878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878787878787878787878a8b87878787878787878787878a83082828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828267830d313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313169a8b878787830b878b8b8b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b87878b830b8b8b8b830787878787878a0a078787878787878787878a015407878787878787878787878787878787878787878a012121212128864a8a078787878787878787878a030b8b8b8b8b8b8b830b8787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878787878787878787878307c787878787878787878787830a81e838282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282826791123131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131316ba8b878787830b878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878783030b8b8b830a0787878787878b87878787878787878787878281235a078787878787878787878787878787878787878a06412121212886115a87878787878787878787878a07cb8b8b8b8b8b8b87ca0787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7878787878787878787878787878b8a87878787878787878787878a0a8a0838282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828267820431313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131317ca8b878787830b8a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787cb8b8b8b830787878787878a0b87878787878787878787878958402b878787878787878787878787878787878787878a064121212128888616ca8787878787878787878787878b830b8b8b8b8b8b8a8a0787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7878787878787878787878787878a0a8a07878787878787878787878a87c8282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828267836431313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131311da8a8a078787830b8a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878a07cb8b8b830b8787878787878b8b878787878787878787878a015840db878787878787878787878787878787878787878a00d121212128888886374a8b87878787878787878787878b87cb8b8b8b8b8303078787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878787878787878a8a87878787878787878787878b8a81e8382828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282673e5b3131313131313131313131313131313131313131313131313131313131313131313131313131313131313131318aa8a8a078787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878a0a8b8b8b8307878787878787830a078787878787878787878a06412126ba0787878787878787878787878787878787878b80d121212128888888863b1b8a87878787878787878787878a03030b8b8b8b830b8a0787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878787878787878787878787ca8a07878787878787878787878a8a0838282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282678204313131313131313131313131313131313131313131313131313131313131313131313131313131313131313169a8a8787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878b87cb8b830a078787878787878a8a078787878787878787878281212126cb8787878787878787878787878787878787878a01512121212888888888863883b7cb87878787878787878787878b87c30b8b8b83030a0787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878787878787878b8a8b87878787878787878787878b87c828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828267831231313131313131313131313131313131313131313131313131313131313131313131313131313131313171a8a8787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878783030b8b8307878787878787878a8a07878787878787878787811121212646b787878787878787878787878787878787878a0028412121288888888888888616440b8787878787878787878787878b87c30b8b8b830b8787878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878787878787878a0a87c7878787878787878787878a0a81e838282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282673e5b3131313131313131313131313131313131313131313131313131313131313131313131313131313175a87c787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878a830b8b8b87878787878787878a878787878787878787878a0958412121256b87878787878787878787878787878787878a0958412121212888888888888886388296bb8787878787878787878787878b8303030b8b8b8a07878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878787878787878a0a8a8b87878787878787878787878a86f8382828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282826431313131313131313131313131313131313131313131313131313131313131313131313131313130a830787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a8b8b87ca07878787878787878a878787878787878787878a00284121212646b7878787878787878787878787878787878a040121212121288888888888888888861886d30b8787878787878787878787878a0b8303030b8a07878787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878a87c3078787878787878787878787cb88382828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282826791123131313131313131313131313131313131313131313131313131313131313131313131311d7c7cb8787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878a8b8b830787878787878787878a878787878787878787878b815121212128874b87878787878787878787878787878787878a01212121212888888888888888888888863b1b830a078787878787878787878787878a0b8b8b8a07878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878a87c7ca078787878787878787878a0a86783828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282823e5b313131313131313131313131313131313131313131313131313131313131313131311d7c7cb8787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787cb830a0787878787878787878a878787878787878787878a00d121212128864307878787878787878787878787878787878b864121212128888888888888888888888886364b0b8b8a0787878787878787878787878787878a0787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878787878787878787ca8b8b87878787878787878787878a86783828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828283643131313131313131313131313131313131313131313131313131313131313131311da87ca0787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787cb87c78787878787878787878a878787878787878787878b86412121212128840a078787878787878787878787878787878b864121212128888888888888888888888888863882928b8b878787878787878787878787878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787830a8b87ca078787878787878787878a89083828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282823e12313131313131313131313131313131313131313131313131313131313131318aa8a8a0787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787830b8b878787878787878787878a8b8787878787878787878b864121212128861293078787878787878787878787878787878b80d12121212888888888888888888888888888888888815b8b8a07878787878787878787878787878787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878787878b8a8b830b8787878787878787878787ca083828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282043131313131313131313131313131313131313131313131313131313131318aa8a878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878783030a0787878787878787878b8a8b87878787878787878786b64121212128888886ba0787878787878787878787878787878b8028412121212888888888888888888888888888888886164287ca07878787878787878787878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878787878b8a8b8b87c78787878787878787878b8b883828282828282828282828282828282828282828282828282828282828282838283828383828282828283828283828282838282828282828282828282828282828282828282828282833131313131313131313131313131313131313131313131313131313131318aa8a878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787830b8787878787878787878b8a8a8b87878787878787878786b6412121212888861a1a8787878787878787878787878787878a018121212121288888888888888888888888888888888886388167cb8787878787878787878787878787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878787878a0a8b8b830b8787878787878787878a03082838282828282838282828282828283828283838282828282828282828383838283838383838382828383838283828383838383838383828282828283828282838282838282828382838431313131313131313131313131313131313131313131313131313131318aa8a878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787ca07878787878787878b8a80d18a87878787878787878786b64121212128888881230b87878787878787878787878787878786b12121212128888888888888888888888888888888888888861646ba8b8787878787878787878787878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878787878a0a8b8b8b83078787878787878787878a882838282838283838282838383828283828282828382838283838382838383838383838382838383838382838383838383838383838383838383838383838383828383838383838382821231313131313131313131313131313131313131313131313131313131318aa87c78787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878307878787878787878307c0d8402a87878787878787878786b64121212128888886374a8787878787878787878787878787878300d12121212888888888888888888888888888888888888888888649573a8b87878787878787878787878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878787878a0a8b8b8b830a0787878787878787878a867838383838383828283838383838382838383838383838383838382828383838383838383838383838383838383838383838383838383838383838383838383838383838383838383826431313131313131313131313131313131313131313131313131313131318aa830787878787830b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878787878a0b878787878787878307364848415a87878787878787878786b64121212128888888864a8b87878787878787878787878787878b80284121212128888888888888888888888888888888888888888886188a1b8a8a07878787878787878787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878a0a8b8b8b8b8b87878787878787878787c6d838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383826431313131313131313131313131313131313131313131313131313131318aa830787878787830b8b8b8b8b8b8b8b8b8b8b8b8b87c787878787878787878a078787878787878305a648412120da8b87878787878787878b86412121212888888886174a8a078787878787878787878787878a0401212121212888888888888888888888888888888888888888888888861883bb8b8787878787878787878787878787878787878787878787cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878a0a8b8b8b8b87c787878787878787878306f838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383823e31313131313131313131313131313131313131313131313131313131311da830787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878305a6412121212126ba87878787878787878b86412121212888888888888b8a878787878787878787878787878787c641212121288888888888888888888888888888888888888888888888888611274a8b87878787878787878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878a0a8b8b8b8b830b87878787878787878b8a0838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383823e31313131313131313131313131313131313131313131313131313131311da87c7878787878b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878787878787878305a6412121212128495a8787878787878787830641212121288888888886115a8b87878787878787878787878787830028412121212888888888888888888888888888888888888888888888888888863297ca8a078787878787878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878787878787878787878a0a8b8b8b8b8b8307878787878787878a037838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383828331313131313131313131313131313131313131313131313131313131318da8a87878787878b8b8b8b8b8b8b8b8b8b8b8b8b87c787878787878787878787878787878b85a64121212121212120da8b878787878787878300d1212121288888888888888a0a8a0787878787878787878787878a06b12121212128888888888888888888888888888888888888888888888888888886164116bb87878787878787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878787878787878787878a0a8b8b8b8b8b830a078787878787878a07c82838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383835b31313131313131313131313131313131313131313131313131313131317ca87878787878a030b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878b873648412121212121212886ba878787878787878300d121212128888888888886364a8a878787878787878787878787878a80d1212121288888888888888888888888888888888888888888888888888888888638864b1a0b87878787878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878b8a8b8b8b8b8b8b8b87878787878787878a86783838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382123131313131313131313131313131313131313131313131643e64125b8475a8a078787878a030b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878a07c648484121264646412636115a8b8787878787878300384121212888888888888886174a830787878787878787878787878b81884121212128888888888888888888888888863616161616163888888888888888888886388957ca07878787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878b8a8b8b8b8b8b8b8b878787878787878787c6d8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838264313131313131313131313131313131313131313131316482828282823ea0a8b8787878787830b8b8b8b8b8b8b8b8b8b8b8a078787878787878787878787878a80d120d6c40406b6b6b6b4074a17ca8787878787878b802841212128888888888888888886ba8787878787878787878787878a07c641212121288888888888888888863638864153b74743b16b164646488888888888888888861b17330787878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878787ca8b8b8b8b8b8b830a078787878787878b82883838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382043131313131313131313131313131313131313131313e828383838383836fa830787878787830b8b8b8b8b8b8b8b8b8b8b8787878787878787878787878787c590240186c0d641212646415116ba8a8307878787878b85684121212888888888888888888123b307878787878787878787878787c5684121212128888888888886188b111b8a8a830b85a6b113b29b16412888888888888888888611240a8a078787878787878787878787878787cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878a8a8b8b8b8b8b8b830b878787878787878a0b8838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383823e31313131313131313131313131313131313131313e82838383838383836da8a87878787878b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878787878307c18026412841288888888636361886430a8a8a0787878b81884121212888888888888888888888840a07878787878787878787878a05a1212121212888888886388a15a7c40a164128888888863636388888888888888888888888888638895a8b878787878787878787878787878b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878a87cb8b8b8b8b8b8b8b8787878787878787830828383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383823e3131313131313131313131313131313131315b3e82838383838383838367a8a87878787878b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878b87c0312841212128888888888888888886116a8a8a0a07878a040121212888888888888888888888863157c787878787878787878787878b86c8412121212888861b16b6b158863616388888888888888888888888888888888888888888888886116a8b8787878787878787878787878787cb8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878a0a8b8b8b8b8b8b8b8b8307878787878787878a867838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383833131313131313131313131313131313131128382838383838383838383827ca8a078787878a0b8b8b8b8b8b8b8b8b830a078787878787878787878a0736484121212128888888888888888888888886ba8b8787878a05a1212128888888888888888888888886395307878787878787878787878786b64121212128888746b1588618888888888888888888888888888888888888888888888888888888888b128a0787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878b8a8b8b8b8b8b8b8b8b87ca078787878787878a86f838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383825b3131313131313131313131313131311283828383838383838383838383a0a8b8787878787830b8b8b8b8b8b8b8b8307878787878787878787878a80d841212128888888888888888888888888861b1a8a8a07878787c641212888888888888888888888888888874b87878787878787878787878a011121212121211748861888888888888888888888888888888888888888888888888888888888888886188b0a07878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8a0787878787878787878787878787878787830a8b8b8b8b8b8b8b8b87cb878787878787878b8a08383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838212313131313131313131313131313164828383838383838383838383838390a8a87878787878b8b8b8b8b8b8b8b8b8b8787878787878787878783056841212128888888888888888888888888888888811a8a8787878a8031212888888888888888888888888888888117c7878787878787878787878b80284126418b16188888888888888888888888888888888888888888888888888888888888888888888638828b8787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878a8a8b8b8b8b8b8b8b8b8b83078787878787878a0b88383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838264313131313131313131313131310482838383838383838383838383838367a8a8a078787878b8b8b8b8b8b8b8b8b8b8787878787878787878b84012121212888888888888888888888888888888886364b8a8b87878305984128888888888888888888888888888888811a87878787878787878787878b864129564848888888888888888888888888888888888888888888888888888888888888888888888886388a0b878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8a07878787878787878787878787878787878a830b8b8b8b8b8b8b8b8b87c78787878787878787c82838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382043131313131313131313131313e8283838383838383838383838383838383b8a8b878787878a030b8b8b8b8b8b8b8b8787878787878787878b86412121288888888888888888888888888888888888861157ca8a078a0401212888888888888888888888888888888888874a8a0787878787878787878a02803158412128888888888888888888888888888888888888888888888888888888888888888888888886364b8a0787878787878787878a030b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878b8a8b8b8b8b8b8b8b8b8b8b87ca07878787878787830678383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383823e31313131313131313131843e8283838383838383838383838383838383836fa87c787878787830b8b8b8b8b8b8b8b8787878787878787830158412128888888888888888888888888888888888888888881130b87878a012128888888888888888888888888888888888633ba8b8787878787878787878a0181212121288888888888888888888888888888888888888888888888888888888888888888888888888883bb8a078787878787878787830b8b8b8b8b8b8b8b8b8b8b878787878787878787878787878787878787ca8b8b8b8b8b8b8b8b8b8b830b878787878787878b8808383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383833e31313131313131313112838283838383838383838383838383838383838367a8a87878787878b8b8b8b8b8b8b830a078787878787878a0598412128888888888888888888888888888888888888888886364b8b8a078a0641288888888888888888888888888888888888863b17ca8787878787878787878b86c8412121288888888888888888888888888888888888888888888888888888888888888888888888888887430a07878787878787878b8b8b8b8b8b8b8b8b8b8b8a078787878787878787878787878787878a0a8a8b8b8b8b8b8b8b8b8b8b8303078787878787878a0288383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838384313131313131311283828383838383838383838383838383838383838383b8a8b878787878b8b8b8b8b8b8b830a0787878787878786b64121212888888888888888888888888888888888888888888886329a8b878a00d848888888888888888888888888888888888888863126ba8a07878787878787878300d84121212888888888888888888888888886363638888886363888888888888888888888888888888881540307878787878787878b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878b8a830b8b8b8b8b8b8b8b8b8b8b87c78787878787878786b83838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382123131313131316482838383838383838383838383838383838383838383836da87c78787878a030b8b8b8b8b830a0787878787878a0028412128888888888888888888888888888888888888888888888886116a8a07816848888888888888888888888888888888888888888638874a830a0787878787878786b6412121212888888888888888863638812b1153b6ca115b1b164128888638888888888888888888888883b40b878787878787878a030b8b8b8b8b8b8b8b8b878787878787878787878787878787878787ca8b8b8b8b8b8b8b8b8b8b8b8b87ca078787878787878b8828383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383826431313131310482838383838383838383838383838383838383838383838382a8a8787878787830b8b8b8b8b830a07878787878782812121288888888888888888888888888888888888888888888888888886174a8a06d128888888888888888888888888888888888888888888863b16ba830787878787878a040121212121288888888888888b195956c15b1b129b1b1b1b1b1b11515b1648888888888888888888888883b5aa0787878787878a030b8b8b8b8b8b8b830a07878787878787878787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b87cb878787878787878301e83838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838264313131313e828383838383838383838383838383838383838383838383833e6fa8b878787878b830b8b8b8b8b8a078787878a07c0d8412128888888888888888888888888888888888888888888888888888888840b8786488888888888888888888888888888888888888888888886388a15aa8b87878787878b81812121212888888888864167415128863636363636363636388888864b11564888888888888888888888840a878787878787878b8b8b8b8b8b8b8b8b87878787878787878787878787878787878a0a830b8b8b8b8b8b8b8b8b8b8b8b8303078787878787878b86f8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383823e3131843e82838383838383838383838383838383838383838383838383838367a8a878787878787cb8b8b8b8b8a0787878787c40121212888888888888888888888888888888888888888888888888888888888888747864888888888888888888888888888888888888888888888888886188b111b830a0787878a8591212121288888829151288638888886163888888888863616388886388b11512638888888888888863647cb8787878787878b8b8b8b8b8b8b830a07878787878787878787878787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a0787878787878a0288383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383833e315b3e8283838383838383838383838383838383838383838383838383838383a0a8a078787878b8b8b8b8b8b8a0787878a0a80d121212888888888888888888888863888812121212128888888888888888888888886db18888888888888888888888888888888888888888888888888888886363121540b8b878a0a86c121212128816b1888888638888641574406b5a5aa0111664126363886312156488888888888888886115a8a07878787878b8b8b8b8b8b8b83078787878787878787878787878787878787830a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8b8787878787878786b8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383833e648383838383838383838383838383838383838383838383838383838383838367a87c78787878a030b8b8b8b8a07878787c70121212888888888888888888886388b1151615165911111115886188888888888888888812888888888888888888888888888888888888888888888888888888888888638812b1a1b0b8a815841212020d63886388b1405a7cb86bb85a6b7ca8a8a8a85a11b188638888b12988888888888888886340a87878787878b8b8b8b8b8b8b8b87878787878787878787878787878787878a07c30b8b8b8b8b8b8b8b8b8b8b8b8b8b8303078787878787878b882838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383b8a8a078787878b8b8b8b8b8a0787878a80284121288888888888888888888b13bb1126361618888886416742988888888888888888888888888888888888888888888888888888888888888888888888888888888888888636112b13b6b15880d15128888156ba8a8a87cb8a8a8a8a8a8a8a8a8a8a86bb840646188636415888888888888886364a8a078787878b8b8b8b8b8b830a07878787878787878787878787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8787878787878787c818383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383831ea830787878787830b8b830a0787878a8151212888888888888888888126c158861611215594059151261887440888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888864a1a16c12841218307ca8a8a8a8a830013e3e05292828a8a8a830a8a83b88886364158812a1648888886174a878787878b8b8b8b8b8b8b8787878787878787878787878787878787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878787c8083838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383b8a8a078787878a030b8b8a0787878a80d12886464638888888888649564616312747ca8a8a8a87ca840b1126c74886388888888888888888888888888888888888888888888888888888888888888888888888888888888888888888861a1156412a0a0a0a8a8a8a87c7c7c17213c3c3c3c3c1a6da8a8a8a8a811648888b14059b1888888888864a8a0787878a0b8b8b8b8b8a07878787878787878787878787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878306f8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838367a8307878787878b8b8b8a07878a0a8641288881564886388611216886163157ca8a8a8a8a8a8a8a8a8a86bb164746463888888888888888888888888888888888888888888888888888888888888888888888888888888888888888864296188a0a0a0a8a87c7cb8b8b8b8a8303e3c3c3c3c3c3c05b0a8a8a8a811b1a13b11b1618888888888b1b830787878b8b8b8b8b8b8787878787878787878787878787878787878307cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878b85a83838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383836ba8a078787878a030b8a07878a07c6412888888b13b153bb13b16641229a8a8a8a8a07429296d7ca8a8a8a86c127464638888888888888888888888888888888888888888888888888888888888888888888888888888888888888815126111a87c6bb8a8a01fb87ca8a830a8b8a93c3c3c3c3c3c3c05a0a8a8a859b18888a1888888888888886db878a0a0a0b8b8b8b8b8787878787878787878787878787878787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a07c838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838367a87c7878787878a0b8a07878a07312128888886312151140407c6b11a8a8a8741a3c3c3c3c3cb028a8a8a8a811127412888888888888888888888888888888888888888888888888888888888888888888888888888888888888641561b1a8a82836a8b86f371f6fb8b830a8a8113c3c3c3c3c3c3c3c216da8a8b864886364b163888888886312a0b8b878a0b8b8b830a07878787878787878787878787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878a881838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838328a8a078787878a0a0a07878b86b12888888888888638888881212a0a830043c3c3c3c3c3c29306ba8a8a8a8a83b64a18888888888888888888888888888888888888888888888888888888888888888888888888888888888882912885aa8281aa0b86fb8929292929492a0a8a83e3c3c3c3c3c3c3c3c3c047ca8a064886329888888886163b1a8a8a07878b8b8b8b8787878787878787878787878787878787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878a81e838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838367a8a87878787878a0a07878b8401288888888888888888861646c7ca81a3c3c3c3c3c3c327ca8a8a8a8a8a8a8a864b1646388888888888888888888888888888888888888888888888888888888888888888888888888888888648811a8b021053728b892941f9292929292b8a8b8613c3c3c3c3c3c3c3c3c05307cb859881212638864a1405a287c787878b8b8b8a078787878787878787878787878787878787c7cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878a86f8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383836da8a078787878a0a07878a01812888888888888888861647440a8363c3c3c3c3c3c3c17a8a8b8b8a8a8a8a8a85a12a1888888888888888888888888888888888888888888888888888888888888888888888888888888888863b17c6d3c3c6db8b81f921f9492929292921f7ca8363c3c3c3c3c3c3c3c3c3c04a8a86b745940a06b6b11158864a8b87878b8b8b87878787878787878787878787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787830a083838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382a8a87878787878a07878784012888888888861631295306b5aa8a93c3c3c3c3c3c21b8a8a8a8b8a030a8a8a8a8156429638888888888888888888888888888888888888888888888888888888888888888888888888888886411a03c3c21b8a0a0926f9492929292929292a0a8a81a3c3c3c3c3c3c3c3c3c3c29a8409511743bb18863638888b87c7878b8b8a078787878787878787878787878787878a8a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878b8b88383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383836730a8b87878787878787878b864888888886415405a28952940743c3c3c3c3c3c3c04a8a8a8b8b8a0a0a8a8a8a86b881612888888888888888888888888888888888888888888888888888888888888888888888888888888646b3e3c3c0430b81f6f946f9292929492929292a8a8b03c3c3c3c3c3c3c3c3c3c21a07c8863616163888888886311a87878b8a0787878787878787878787878787878b8a8a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878a07c82838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838390307ca8a078787878787878a859a17411a06b40161261b1646b053c3c3c3c3c3c3c17a8a837a0949292a0a830a8a80d641563888888888888888888888888888888888888888888888888888888888888888888888888886116283c3c3c1737a01f941fa0a8a8a01f92929292a0a8a8993c3c3c3c3c3c3c3c3c3cb1a86463888888888888886374a87878a078787878787878787878787878787830a8a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a0a8678383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383a0a8a0a8a8a0787878787878a015881264128863618888b1b1a03c3c3c3c3c3c3c3c28a8b8b8a09494941fb8a830a81888a1128888888888888888888888888888888888888888888888888888888888888888888888888812b81a3c3c3c11376f1f1f1fb8a8a8a8301f92929292a8a8073c3c3c3c3c3c3c3c3c3c21b811616363888888888863b1a8a078787878787878787878787878787878b8a8a8a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878a880838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838330a8a0a0a8a878787878787878746388888888888888886411953c3c3c3c3c3c3c3c6ba8a8b81f6f92929292b8a8a8a80d641563888888888888888888888888888888888888888888888888888888888888888888888863156d3c3c3c3c28b86f941f1f37a8a87ca8b892929292a0a8283c3c3c3c3c3c3c3c3c3c3c3e7cb164b1b1b164648888886bb878787878787878787878787878787878a8a8a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787c288383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382a8a87878b8a8a8787878787878a01288888888888888616c74123c3c3c3c3c3c3c3cb8a8b81f289494b8929292a8a8a8188816888888888888888888888888888888888888888888888888888888888888888888888888883b1a3c3c3c3ca0b81f1f946fa8a8a8a830b89292929294a8b8213c3c3c3c3c3c3c3c3c3c3c743ba1b1641288888888616ca878787878787878787878787878787830a87ca8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787830b88383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838367a8a8787878a8a87c7878787878b815618888888888633b6b88633c3c3c3c3c3c3c3c6ba8a01f6f92b8a8b89292a0a8a85a64b164888888888888888888888888888888888888888888888888888888888888888888888812b13c3c3c3c3cb8a0922892a0a8a8a8a8b8a8949292929237a8323c3c3c3c3c3c3c3c3c3c3cb11288888888888888886364a87878787878787878787878787878a0a8736ba8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878b8a8828383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383836fa830787878b8a8a83078787878782888888888611259118888633c3c3c3c3c3c3c3ca0a81fa09492b8a8a8289292a8a8a80212b1888888888888888888888888888888888888888888888888888888888888888888888864a93c3c3c3ca9301f941f92b8a8a8a8a8b8a81f92929292a0a8053c3c3c3c3c3c3c3c3c3c3c1a64888888888888888888886bb878787878787878787878787878a87c406c7330b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878a0a867838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383b8a8a0787878b830a8a8b878787878b8b16388641695b1888888633c3c3c3c3c3c3c3ca0a81fa09294a8a8a8b89292a0a8a89512648888888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c997c926f9292b8a8a8a8a8b8a8a0929292921fa8073c3c3c3c3c3c3c3c3c3c3c638888888888888888888863117c787878787878787878787878b8a87002127330b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a0787878787878a880838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382a8a878787878b8b87ca8a8b8787878a040881574b18863888888633c3c3c3c3c3c3c2111b86f1f926fa8a8a8a892921fa8b82812888888888888888888888888888888888888888888888888888888888888888888888888213c3c3c3c3c1a7c946f9292a8a8a86d6d37a8a09292929294a8743c3c3c3c3c3c3c3c3c3c3c63888888888888888888886315a87878787878787878787878a0a8b89512127330b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878a88083838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383831ea8a878787878b8b8b830a8a8a078787830641288638888888888633c3c3c3c3c3c3c3c17b86f9292b8a8b87ca8929292a8b8a012888888888888888888888888888888888888888888888888888888888888888888888888213c3c3c3c3c1aa81f1f9294a8a86d3c01a8a8a09292929292a8363c3c3c3c3c3c3c3c3c3c3c63888888888888888888888864a8a078787878787878787878a8a8116412125a30b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878306f8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383a0a8b8787878a0b8b8b8b8b8a8a8a07878b8116188888888888888633c3c3c3c3c3c3c3c54b81f929237a83628a8949292b8a8a8b1888888888888888888888888888888888888888888888888888888888888888888888888213c3c3c3c3c1aa8a0929292a8301a3c17a8a8a09292929292a8533c3c3c3c3c3c3c3c3c3c3c88888888888888888888888888b8b8787878787878787878b8a86b6c6412127330b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878b86b8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382a8a878787878a0b8b8b8b87c6ba0a8b878787c6488888888888888633c3c3c3c3c3c3c3c74b81f9294a86d3c04a81f92926fa8a8a1888888888888888888888888888888888888888888888888888888888888888888888888213c3c3c3c3c05a8a0929292b8a8053c0aa8a8a09292929292a8533c3c3c3c3c3c3c3c3c3c3c8888888888888888888888888828a8787878787878787878a8b83b158812127c30b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7c787878787878b8a88383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838380a87c78787878b8b8b8b8b8a86b8840a878787c1561888888888888633c3c3c3c3c3c3c3c74a01f926fa8743c32a81f92921fa8a852888888888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c3c04a8b8929292b8a8293c36a8a8a0929292929230173c3c3c3c3c3c3c3c3c3c2188888888888888888888888861a1a87878787878787878b8a8591588881264a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307c787878787878a0a881838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383b8a8a078787878b8b8b8b8b8a8b8888874a878b84063888888888888883c3c3c3c3c3c3c3c6da01f92a0a8a03c99a81f92921fa8a801611288888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c3c3ea8a0929292a0a8a007a0a8a86f9292929292b8293c3c3c3c3c3c3c3c3c3c6188888888888888888888886361b16b7878787878787878a87395888888120da8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878a0a867838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383830467a8a87878787878b8b8b8b8b8a86b88886115a0a0b888888888888888883c3c3c3c3c3c3c3c6db894926fa87c9999a86f929294b8a8073c1288888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c3c3ea8b8929292a0b8a8a8a8a8b81f9292929292373e3c3c3c3c3c3c3c3c3c3c638888888888888888888864b164646c78787878787878a0a870158888888415a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787878a88083838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383836ba8b878787878a030b8b8b8b8a86b8888886164a0a86488888888888888213c3c3c3c3c3c3c6db8921f1fa8a85317a8a0929292b8a83e3c1288888888888888888888888888888888888888888888888888888888888888888888633c3c3c3c3c04a8b89292926fb8a8a8a8a8a01f9292929292a8053c3c3c3c3c3c3c3c3c3c888888888888888888888864b8a0b1b1a078787878787830a81564a188888402a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878a8288383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838381a8a87878787878b8b8b8b8b8b8a8a0888888886164a8a161888888888888613c3c3c3c3c3c3c17b8921f92b8a8a8a8a8a0929292a0a8043c1212888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c1ab8b8a092921fb8a8a8a8b017289292929292a8b13c3c3c3c3c3c3c3c3c6188888888888888888888886311b8a064a0787878787878a85a128402b1638859a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb87878787878787cb88383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838328a8a07878787878b8b8b8b8b8b8a840888888888864a81161888888888888613c3c3c3c3c3c3c29b892a09228a8a8a8a86f929292a0a8043c8812888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3ca9b8b8b8929292b8b8a8a8a93c321e92929294306d3c3c3c3c3c3c3c3c3c6388888888888888888888886315b8a0b0287878787878a0a85984120d6c631240a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83030787878787878b8a882838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382a8a878787878787830b8b8b8b8b8a8a0888888888888a15a88888888888888633c3c3c3c3c3c3c043092b89294b8a8a8b138929292a0a8053c881288888888888888888888888888888888888888888888888888888888888888888888213c3c3c3c216bb8b8929292a0b8a830213c210692929292376d3c3c3c3c3c3c3c3c3c8888888888888888888888888864b878b8117878787878b8a8038412157463125aa8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878a0a86783838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383046fa8a07878787878a030b8b8b8b8b8a85a888888888888616ca1618888888888883c3c3c3c3c3c3c327c28a09292a0a8a03c1a6f9292a0a81a3c881288888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c3c28b8a894929294b8b8a0323c3c3e78929292a8293c3c3c3c3c3c3c3c618888888888888888888888888888287878a0787878787830a815128402956112a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787878a86f8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838382a87c787878787878b8b8b8b8b8b8b830a864631215128888124088888888888888213c3c3c3c3c3c3c6bb8a01f921f37b03c3c901f92a0a8323c881288888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c0a37a8a0929292a01f941a3c3ca9a092921fa81a3c3c3c3c3c3c3c3c6388888888888888888888888888633ba078a07878787878a8a8020d126cb16164a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878a8b8838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383046fa878787878787878b8b8b8b8b8b8b8b8a81561880d0212886195b1638888888888613c3c3c3c3c3c3c74a81f1f92929228213c1a2892b8a8213c881288888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c1ab8373092929292a0a0053c3c3c909492a06b213c3c3c3c3c3c3c2188888888888888888888888888886315a07878a078787878a8401212126c88880da830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830307878787878787ca882838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838381a8b8787878787878a030b8b8b8b8b8b8b8a840638863151584886474638888888888633c3c3c3c3c3c3c3ea8286f929292a01a3c3c1e92b86b3c3c88128888888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c3c6da0a81f929292921f383c3c3c909292a874213c3c3c3c3c3c3c63888888888888888888888888888863b1a078787878787878a80312126415638802a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c78787878787830a8678383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383b8a878787878787878b8b8b8b8b8b8b8b8b87ca8646388885964886374648888888888883c3c3c3c3c3c3c21b8b8a09292921f293c3c3e1fa8283c3c88128888888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c3ea030b8929292929292323c7992926fa8053c3c3c3c3c3c3c3c8888888888888888888888888888886364a0787878787878a0731212126c64888820a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8787878787878b8a880048383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383056fa87878787878787878b8b8b8b8b8b8b8b8b8b8a81161886364598463b116618888888888213c3c3c3c3c3c3c06a8a01f92929290213c891fa8013c3c1212888888888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c21b0a0a86f9292929292921e929292a8283c3c3c3c3c3c3c3c618888888888888888888888888888888864a0787878787878304084120da163881273a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878a0a86b83838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383830581a8a0787878787878787830b8b8b8b8b8b8b8b8b8a8a864638863590d888874888888888888613c3c3c3c3c3c3c216ba0a09292921f382191a0a8043c3c1212888888888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c05a0a8b81f9292929292929292a0a8993c3c3c3c3c3c3c3c888888888888888888888888888888888812a0787878787878a80284126c8888880da8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb87878787878a0a8a88383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383837c7c7878787878787878b8b8b8b8b8b8b8b8b8b8b830a8116388886440886374648888888888883c3c3c3c3c3c3c3cb1b828a0929292921e92b87c323c3c128888888888888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c3c0637a81f1f1f92929292926fa8b13c3c3c3c3c3c3c3c61888888888888888888888888888888888812a07878787878a0a80d84036463888495a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878a8a88283838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383a0a8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8a8a8b1618888400d611529638888888888613c3c3c3c3c3c3c3ca0a01f1f9292929292a8283c3c61128888888888888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c3c74a837929294929292a0a8013c3c3c3c3c3c3c3c3c88888888888888888888888888888888888888a07878787878306b640db1638812125aa8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a8a86705838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383830580a8a07878787878787878a030b8b8b8b8b8b8b8b8b8b8b87ca830126363152088b13b618888888888a11a3c3c3c3c3c3c3c3ea8941f1f9292921fa8293c3c6312888888888888888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c3c3c01a8371f92921fb8a0053c3c3c3c3c3c3c3c3c6164646488888888888888888888888888888888a07878787878a8590db18888888402a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c78787878787830a86f058383838383838383838383838383838383838383838383838383838383830583838383838383838305058383838383838383838383838383838383838383838383838383838383838383838383838383838383838383830582a830787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a86b8861886b64129588888888886364b0a93c3c3c3c3c3c3c6da8a094929292b8a8323c3c8812888888888888888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c3c3c3e6b6ba0b001053c3c3c3c3c3c3c3c3c1a153b3b1564128888888888888888888888888888886b7878787878a83b64888888126473a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878b8a86b8383838383838383838383838383838383838383838383838383838383838384846483838383830512310583838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383b8a87878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8a8a8a86b886111958840888888888864b1b16d3c3c3c3c3c3c3ca974a8a01f1fa0a8113c3c3c121288888888888888888888888888888888888888888888888888888888888888888888888888888888633c3c3c3c3c3c3c611a99213c3c3c3c3c3c3c3c3c3c1a1115b1b16488888888888888888888888888888888886b78787878a0a81588888812126ba8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878a0a87c83838383838383838383838383838383838383838383838383838383838383123131846405055b3131310583838383838383838383838383838383838383838383838383838383838383838383838383838383838383830528a8a0787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8a828a8a061b175647cb16388881264888840523c3c3c3c3c3c3c3cb17ca8a8a8a81a3c3c3c12888888888888888888888888888888888888888888888888888888888888888888888888888888888888613c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c1aa06c8861888888888888888888888888888888888888886ba0787878a0a8156388881259a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a8a882058383838383838383838383838383838383838383838383838383838383123131313131313131313183838383838383838383838383838383838383838383838383838383838383838383838383838383838383830580a8a078787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a86b64113b88b895a86c618888888812b16440173c3c3c3c3c3c3c3ca9b13628053c3c3c6112888888888888888888888888888888888888888888888888888888888888888888888888888888888888883c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3e406412156488888888888888888888888888888888888888a0a0787878a0a81563881295a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c787878787878a8a867058383838383838383838383838383838383838383838383838383838383643131313131313131315b838383838383838383838383838383838383838383838383838383838383838383838383838383838383830581a8b878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8288864b11511a86c6188888888648888646b28323c3c3c3c3c3c3c3c3c3c3c3c3c3c881288888888888888888888888888888888888888888888888888888888888888888888888888888888888888633c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3274401263888864888888888888888888888888888888888888886ba0787878a0a815881259a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787830a86f05838383838383838383838383838383838383838383838383838383838304313131313131313131128383838383838383838383838383838383838383838383838383838383838383838383838383838383830582a87c7878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a840888863744088888888888888886488886ba83e3c3c3c3c3c3c3c3c3c3c3c3c1a6488888888888888888888888888888888888888888888888888888888888888888888888888888888888888888816053c3c3c3c3c3c3c3c3c3c3c21b1406c888888888888888888888888888888888888888888888888886bb878787878a80d1259a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878b8a85a838383838383838383838383838383838383838383838383838383838383053131313131313131311283838383838383838383838383838383838383838383838383838383838383838383838383838383830583b8a87878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83030a0a84088616b9561888888888888888888888840a8b005213c3c3c3c3c3c3c3c21a064888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888642817a93c3c3c3c3c3c9929741195646388888888888888888888888888888888888888888888888888a0a078787878b8596ba830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878a0a8a883838383838383838383838383838383838383838383838383838383830531313131313131313131316483838383838383838383838383838383838383838383838383838383838383838383838383838383836ba8a07878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca078a0a811887c3b61888888888888888888888888167ca8752806041a32a9320728028888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888863881130b03e3eb117b011116c646388888888888888888888888888888888888888888888888888888828a078787878b8a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c787878787878a8a8810583838383838383838383838383838383838383838383838383830584313131313131313131313131048383838383838383838383838383838383838383838383838383838383838383838383838383056fa8a07878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c78787878b828a81563888888888888888888888888638864157440406b6b6b6ba03b8888888888888888888888886164a11288888888888888888888888888888888888888888888888888888888888888888863b111406b407464888863888888888888888888888888888888888888888888888888888888888828a078787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878a8a88005838383838383838383838383838383838383838383838383830584313131313131313131313131313105838383838383838383838383838383838383838383838383838383838383838383838383051ea8b8787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb87878787878b8a8b16388888888888888888888888888886363638888646464888863888888888888888888888863b140648888888888888888888888888888888888888888888888888888888888888888888888636388888861888888888888888888888888888888888888888888888888888888888888888888a0a078787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787ca8280583838383838383838383838383838383838383838383838305843131313131313131313131313131313105838383838383838383838383838383838383838383838383838383838383838383830581a830787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8b87878787878a0a8b1638888888888888888888888888888888888888888638888888888888888888888888888636440886388888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888126ba078787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878b8a8b8838383838383838383838383838383838383838383838383830564121231313131313131313131315b12640583838383838383838383838383838383838383838383838383838383838383838305837ca87878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a8787878787878b87cb163888888888888888888888888888888888888888888888888888888888888888888888861743b61888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888812b8a078787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a8a88205838383838383838383838383838383838383838383838383838383050564313131313112050583838383838383838383838383838383838383838383838383838383838383838383838305835aa878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7c787878787878b87cb1638888888888888888888888888888888888888888888888888888888888888888888888631640888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888863647ca078787878b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7878787878787ca867058383838383838383838383838383838383838383838383838383838383831231313131058383838383838383838383838383838383838383838383838383838383838383838383838383056fa8a07878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8b8787878787878b87cb163888888888888888888888888888888888888888888888888888888888888888888888888883b12888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888886116a87878787878b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878b8a86f0583838383838383838383838383838383838383838383838383838383838305313131648383838383838383838383838383838383838383838383838383838383838383838383838383af80a8a078787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a0787878787878b8a8156388888888888888888888888888888888888888888888888888888888888888888888888888881588888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888646ba878a0a07878b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878a0a8b805838383838383838383838383838383838383838383838383838383838383831231310583838383838383838383838383838383838383838383838383838383838383838383838383af67a8b8787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a8787878787878a030a8118888888888888888888888888888888888888888888888888888888888888888888888888888636459888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888a0a87c78b8a07878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878a8a8830583838383838383838383838383838383838383838383838383838383838305316483838383838383838383838383838383838383838383838383838383838383838383838383af67a8b87878787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c30787878787878b8b8a8b888888888888888888888888888888888888888888888888888888888888888888888888888888863b1591288888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888886115a8a8b87830b87878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878b8a88105838383838383838383838383838383838383838383838383838383838383830505838383838383838383838383838383838383838383838383838383838383838383838383af81a87c78787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878a0b8b830a8b16388888888888888888888888888888888888888888888888888888888888888888888888888886329158888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888863647c30a8a07830b87878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a0a880af8383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383af67a8a8787878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8787878787878a0b8b8b8a8116188888888888888888888888888888888888888888888888888888888888888888888888888888888a1648888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888840a8b8a8a07830a07878787cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878a8a00583838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383af67a8a87878787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307c787878787878b8b8b8b830a86463888888888888888888888888888888888888888888888888888888888888888888888888888863640d84888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888886115a8b8b8a8787830b87878787c30b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787830a883058383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383af67a8a878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878b8b8b8b8b8a84063888888888888888888888888888888888888888888888888888888888888888888888888888888120d1288888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888863647ca8b8307c787830b87878783030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878a0a8820583838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383af81a8a878787878787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878a0b8b8b8b8b830a815618888888888888888888888888888888888888888888888888888888888888888888888888888881212128888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888863126ba8b8b87c30787830b8787878307cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878a817af838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383af81a8a8a07878787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8787878787878b8b8b8b8b8b8b8a87c648888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888886388a0a830b8b87cb878a0b8b8787878b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878a86b058383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383830583838383830583838383af82a8a8a078787878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307c787878787878b8b8b8b8b8b8b8b8a840638888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888886ba8a8b8b8b8a8b878a0b8b8787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878b8a883af838383838383838383838383838383838383838383838305838383838383838383838383838383838383838383838383838383838383058383058383af827ca8b878787878787878787878787878787878787cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb87878787878a0b8b8b8b8b8b8b8b87ca8296188888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888a0a8a8b8b8b8b8a8a078a0b830787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787878a0a817af8383838383838383058305830505058383050583838305058383830583058305058305058305838383050505838383050505830583838305838383af827ca87c7878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878b8b8b8b8b8b8b8b8b8b8a87c6463888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888638811a8a830b8b8b8b8a8a078a0b830a07878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787878a0a85a0505838383838305058305050505058305050505050505050505050583058305050505830505050505050505050505050505050505050505050583af8230a8a87878787878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8787878787878b8b8b8b8b8b8b8b8b8b8b8a86b8888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888886312a0a8a87cb8b8b8b8b8a87878b8b830a07878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878a8a882af0505838383830505050505050505050505050505050505050505050505050505050505058305050505050505050505050505050505050583af8330a8a8a078787878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7c787878787878b8b8b8b8b8b8b8b8b8b8b830a8116388888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888815648488888888888888888888888888888888888888888888888888888888888888888888646ba8a87cb8b8b8b8b830a87878b8b8b8a0787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787ca880af05050505050505050505050505050505050505050505050505050505050505050505050505050505050505050505050505050505050505af83b8a8a878787878787878787878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8b87878787878a0b8b8b8b830b8b8b8b8b8b8b830a8746388888888888888888888888888888888888888888888888888888888886412888888888888888888888888888888888888888888636312116c1288888888888888888888888888888888888888888888888888888888888888888812b16ba8a830b8b8b8b8b8b87c7c7878b8b8b8b8787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c78787878787878b8a8b8838b05050505050505058b0505050505050505050505050505050505050505050505050505058b05050505058b05050505050505050505af83b8a830787878787878787878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8598888888888888888888888888888888888888888888888888888888888b103888888888888888888888888888888888888886388b1115a748888888888888888888888888888888888888888888888888888888888888888888861b1b8a8a8b8b8b8b8b8b8b8b8a8b87878b8b8b8b8787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c78787878787878b8a8a881af050505050505058b8b8b058b058b8b8b8b8b8b058b8b8b8b8b8b8b058b8b8b8b8b8b8b8b8b8b8b8b8b8b058b8b8b8b8b8b8b8b05af83b8a8b8787878787878787878787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0a0a8401261888888888888888888888888888888888888888888888888888888740288888888888888888888888888888888886164a0a8116463888888888888888888888888888888888888888888888888888888888888888888631530a8a8b8b8b8b8b8b8b8b8b8a8a07878b8b8b8b8787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787878a0a8a86faf8b8b8b8b058b8b8b05058b8b05058b8b8b05058b8b0505058b058b8b058b8b0505058b058b8b058b8b05058b8b8b8b8b8b058baf8337a8a0787878787878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878a8b8b161888888888888888888888888888888888888888888888888888812404064618888888888888888888888636364116b746461888888888888888888888888888888888888888888888888888888888888888888618811a8a830b8b8b8b8b8b8b8b8b830a8a07878b8b8b830787878307cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878a8b83083af8b05058b058b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b058b8b8b8b8b8b8b8b8b8b8b8b8b8baf827ca878787878787878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a87878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8787878787ca895886188888888888888888888888888888888888888888888888888886c6b3b6488638888888888888888b174401688618888888888888888888888888888888888888888888888888888888888888888888863b15aa87cb8b8b8b8b8b8b8b8b8b8b87c7c787878b8b8b830787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787c7ca881af8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8bafaf67a87c78787878787878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830307878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878b8a86bb161888888888888888888888888888888888888888888888888886312154059b16412128812b13b95a164886188888888888888888888888888888888888888888888888888888888888888888888638895a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8a8b8787878b8b8b830787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878b8a8a86faf8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8baf836fa8b878787878787878787878787878787878787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878a0a8a8748863888888888888888888888888888888888888888888888888886312b1b1b1646464646412886388888888888888888888888888888888888888888888888888888888888888888888888863b16ba87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a0787878b8b8b830a07878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a0a8303083af8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8bafaf82b8a8b878787878787878787878787878787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787ca8a86b64638888888888888888888888888888888888888888888888888888636388888888888888888888888888888888888888888888888888888888888888888888888888888888888888611274a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca878787878b8b8b830a07878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878787878a8b8a881af8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8bafaf80a8a8a078787878787878787878787878787878787878a0a8b8b8b8b83030307ca8a87c3030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878b8b8b8a8a86461888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888863883bb8a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a87c78787878b8b8b830b8787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878a87ca86faf8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8baf83a0a8a878787878787878787878787878787878787878a0b8a8a8a8a8a8a87ca8a87ca06ba8a8a8a8a8a8a8a87cb8b8b8b8b8b8b8b8b8b8a87878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878a030787ca8a8646188888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888861646ba8a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8b878787878b8b8b830b8787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787830a8b8308baf8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8bafaf817ca8307878787878787878787878787878787878a0b8a8a8a8a8a8a8a8a828050504053c32176b7c7ca8a8a8a8a8a8a8a830b8b8b8b8b8b8a87878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878a8a0b80d40a8a164888888888888888888888888888888888888888888888888888861638888888888888888888888888888888888888888888888888888888888888888888888638874a8a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a078787878b8b8b8b8b8787878307cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878b8a8b8a881af8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8baf836fa8a8b878787878787878787878787878787878a07ca8a8a830b8b8b830b8b86b6d993c3c3c3c3c3c051711a8a87c30b830a8a8a8a8b8b8b87ca87878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878b8b83012846ca87c74886388888888888888888888888888888888888888888888a13bb1648888888888888888888888888888888888888888888888888888888888888888886112a0a8a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a87878787878b8b8b8b830787878b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a0a830a828af8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8bafaf82b8a8a8a0787878787878787878787878787878b8a8a8a830b8b8a0a0a0a0a0a0a0a0a006213c3c3c3c3c3c3c2117a8a0b87ca87c7ca8a8a87cb830a878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a87c6412886440a86b648863888888888888888888888888888888888888886311a81864888888888888888888888888888888888888888888888888888888888888888861b17ca87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a878787878a0b8b8b8b87ca07878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878a8a87c7c83af8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8bafaf80a8a8b87878787878787878787878787878a030a8a87cb8a0a0a0a0a0a0a0a0a0a0a0a0a06d3e3c3c3c3c3c3c3c3c212830a0a0b8b87ca8a8a8a87ca87c78787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878b8a8168412886316a8a8a064618888888888888888888888888888888888888812956488888888888888888888888888888888888888888888888888888888888888638874a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a87c78787878b8b8b8b8b830a07878787cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787830a87ca882af8b8b8b8b8baf8b8b8b8b8b8b8b8b8baf8b8b8b8b8b8b8b8b8b8b8b8b8b8b8bafaf83a0a87ca07878787878787878787878787878b8a8a837a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a01a3c3c3c3c3c3c3c3c32b8b8a0a0a0a0a0b830a8a8a83078787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878787c300d121288611240a8a8596461888888888888888888888888888888888888638888888888888888888888888888888888888888888888888888888888888863b16ba830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca8b878787878b8b8b8b8b830b87878787c30b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878787878b8a8a8a880af8b8b8b8baf8b8b8b8b8bafafaf8b8b8baf8b8bafaf8baf8b8b8b8b8b8b8baf8b80a8a8a07878787878787878787878787878a0a8a87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0053c3c3c3c3c3c3c3c3ea8a0a0a0a0a0a0a0a0a07cb878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878787c7364121288638815a8a87c95126188888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888611259a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a8a8a078787878b8b8b8b8b8b8b8787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca078787878787878a0a8a8a85aafaf8b8b8bafafaf8b8b8bafafaf8bafaf8baf8baf8bafaf8b8bafaf8bafaf83a0a8b8787878787878787878787878787878b8a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8053c3c3c3c3c3c3c3c28a8a0a0a0a0a0a0a0a0a8a078787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a840121288888861646ba8a87c95126388888888888888888888888888888888888888888888888888888888888888888888888888888888888861883b5aa8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a8a8a878787878a0b8b8b8b8b8b8b8787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878a8a8a8a883afafaf8bafafafafafafafafafafafafafafafafafafafafafafafafaf817ca8a07878787878787878787878787878787ca8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b87c053c3c3c3c3c3c3c327cb8a0a0a0a0a0a0a0a8a078787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a802848888888863883ba8a8a830b1618888888888888888888888888888888888888888888888888888888888888888888888888888886188156b11a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a8a8a83078787878a0b8b8b8b8b8b8b8787878a0a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787830a8a8a881afafafafafafafafafafafafafafafafafafafafafafafafafafaf836fa8b8787878787878787878787878787878a0a8a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b81a3c3c3c3c3c3c3c01a8a0a0a0a0a0a0a0a87878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878787c64848888888888616440a8a8a83b886388888888888888888888888888888888888888888888888888888888888888888888886188155a400d59a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a8a830b8a8a078787878b8b8b8b8b8b8b83078787878a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878b8a8a8a880afafafafafafafafafafafafafafafafafafafafafafafafafaf8137a8a0787878787878787878787878787878a0a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b86ba93c3c3c3c3c3c2130b8a0a0a0a0a0b8a878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878b840128888888888886388295aa8a8a06461888888888888888888888888888888888888888888888888888888888888886361881540400d8415a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca8a8b8a0b8a87878787878b8b8b8b8b8b8b830a0787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878a0a8a8a86bafafafafafafafafafafafafafafafafafafafafafafafaf836fa8b878787878787878787878787878787878b8a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030283c3c3c3c3c3c3c0aa8a0a0a0a0a030a878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878787878a803848888888888888861883b7ca8a8958861888888888888888888888888888888888888888888888888888888618829116b180d12841273a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca8a830a0a0a0a87c7878787878b8b8b8b8b8b8b830a0787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878a8a8a8a883afafafafafafafafafafafafafafafafafafafafafaf817ca87878787878787878787878787878787878b8a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8533c3c3c3c3c3ca97cb8a0a0a0a07ca878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a07312848888888888888888611295a8a830158861888888888888888888888888888888888888888888886363123b6b5a180d8412128495a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a8a8a87cb8a0a0a0b8a8b878787878a0b8b830b8b8b8b8b8b8787878787c30b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878b8a8a8a882afafafafafafafafafafafafafafafafafafafaf836ba8a07878787878787878787878787878787878b8a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a83e3c3c3c3c3c3c36a8a0a0a0a07ca878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a8958412888888888888888888611295a8a86bb18863888888888888888888888888888888888863618815286b590d12841212128864a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca8a8a87cb8a0a0a0a0a0b8a8a078787878b8b8b8b8b8b8b8b8b8b878787878b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878a0a8a8a867afafafafafafafafafafafafafafafafafafaf81a830787878787878787878787878787878787878b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b87c993c3c3c3c3c99a8b8a0a0a07ca878787878b8b8b8b8b8b8b8a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878a07c64128888888888888888888888611295a8a86b15888888888888888888888888888863618864746b400312841212121212886374a830b8b8b8b8b8b8b8b8b8b8b8b8b8b830a8a8a8a87cb8a0a0a0a0a0a0a0a87c7878787878b8b8b8b8b8b8b8b8b8b878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a8a8a86fafafafafafafafafafafafafafafafafaf8ba0a8a0787878787878787878787878787878787878b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a03c3c3c3c3c3cb0a8a0a0a07c7c78787878b8b8b8b8b8b8a0a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878a8591212888888888888888888888888616474a8a8700d888888888888888888636388643ba05a596412841212121212888888127ca8b8b8b8b8b8b8b8b8b8b8b8b8b87ca8a8a8a8741aa0a0a0a0a0a0a0a0b8a8b87878787878b8b8b8b8b8b8b8b8b8b87878787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787ca8a85aafafafafafafafafafafafafafafafaf83b8a878787878787878787878787878787878787878b8a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8533c3c3c3c3c05a8a0a0a07c7c78787878b8b8b8b8b8a078b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878b8730d121288888888888888888888888888636435737c700264886188888864b1746b5a400212841212121212128888888861a1a830b8b8b8b8b8b8b8b8b8b8b87ca8a8a87c17993c216ba0a0a0a0a0a0a0b8a87878787878a0b8b8b8b8b8b8b8b8b8b878787878787c30b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878b8a8a8a883afafafafafafafafafafafafafaf81a8a878787878787878787878787878787878787878a0a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8043c3c3c3c3ca07ca0a07c7c787878a0b8b8b8b8b87878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878a84064128888888888888888888888888888888864955aa8a86b7415165970703503641212121212128888888888888888886ba8b8b830b8b8b8b8b8b830a8a8a8a8a836323c3c3c1ab8a0a0a0a0a0a0a0a8b87878787878b8b8b8b8b8b8b8b8b8b8307878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878a0a8a8a882afafafafafafafafafafafafaf81a8307878787878787878787878787878787878787878a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b86b213c3c3c3cb1a8a0a0307c787878a0b8b8b8b87878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878307c02121288888888888888888888888888888888881264039540186c030d12848412121212888888888888888888886115a87ca8a8a8a8a8a8a8a8a8a8a8a8b8b8b81a3c3c3c3c3eb8a0a0a0a0a0a0b8a8787878787878b8b8b830b8b8b8b8b8b87ca078787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878787878a8a8a881afafafafafafafafafafafaf81a87c78787878787878787878787878787878787878787ca830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a86d3c3c3c3c3cb8b8a0b87c787878a0b8b8b8a07878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a0a86b12128888888888888888888888888888888888888884841212121212121212128888888888888888888888888888b8a8a87cb8b8b8b83037b8b8b8a0a0a0a030053c3c3c3c07b8a0a0a0a0a0a030b8787878787878b8b8b8b8b8b8b8b8b8b830b87878787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878b8a8a86fafafafafafafafafafafaf82a87c7878787878787878787878787878787878787878b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8383c3c3c3c07a8a0b8a8787878a0b8b8b8787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a8a80284888888888888888888888888888888888888888812121212121212128888888888888888888888888888636ca8a87ca0a0a0a0a0a0a0a0a0a0a0a0a0b8a8043c3c3c3c36b8a0a0a0a0a0a0a8a07878787878a0b8b8b8b8b8b8b8b8b8b830b878787878787c7cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a0a8a85aafafafafafafafafafaf8b377ca07878787878787878787878787878787878787878a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8043c3c3c617cb8b8a8787878a0b8b8a0787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878b8a86b121288888888888888888888888888888888888888888888888888888888888888888888888888888888886340a837a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a83e3c3c3c3cb0b8a0a0a0a0a0b87c787878787878a0b8b8b8b8b8b8b8b8b8b830b87878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878a030b8b8b8b8b8b8b878787878787878787878a8a8a883afafafafafafafafaf287ca0787878787878787878787878787878787878787830a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b81a3c3c3c74a8a0a8787878a0b8b8a0787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878a8a80d128888888888888888888888888888888888888888888888888888888888888888888888888888888888887ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8043c3c3c21a0b8a0a0a0a0a030b8787878787878b8b8b8b8b8b8b8b8b8b8b8b8307878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878a0b8b8b8b8b8b830a0787878787878787878a0a8a882afafafafafafafaf67a8a07878787878787878787878787878787878787878a0a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0306b993c3c99a8b8a8a07878a0b8b8a0787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787830a80284888888888888888888888888888888888888888888888888888888888888888888888888888888886115a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a93c3c3c996ba0a0a0a0a0a07c78787878787878b8b8b8b8b8b8b8b8b8b8b8b830787878787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787878787878b8b8b8b8b8b8a0787878787878787878787ca867afafafafafafaf83a830787878787878787878787878787878787878787878a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0a93c3c0a377ca07878a030b878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878a0a81884128888888888888888888888888888888888888888888888888888888888888888888888888888886340a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030013c3c3c3c05b8a0a0a0a0a0b8b8787878787878a0b8b8b8b8b8b8b8b8b8b8b8b830a078787878787c7cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878787878b8b8b8b8b8b878787878787878787878a0a828afafafafafafaf28a8a07878787878787878787878787878787878787878b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8363c3c3c28a8b878787830b878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83030b8b8b8b830a078787878a0a86b1212888888888888888888888888888888888888888888888888888888888888888888888888888888127ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b13c3c3c3c3e30a0a0a0a0a030a0787878787878a0b8b8b8b8b8b8b8b8b8b8b8b830a07878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878787878787830b8b8b8b87878787878787878787878a830afafafafafaf82a87c787878787878787878787878787878787878787878a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8043c3c04a830787878b8a078787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0a0b8b8b8b830b87878787878a87c641288888888888888888888888888888888888888888888888888888888888888888888888888886129a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a83e3c3c3c3c0737a0a0a0a0b87c78787878787878b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878787878787878787cb8b8307878787878787878787878a8a883afafafafaf28a8a07878787878787878787878787878787878787878b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b830a93c3c06a8787878b8a07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878b8b8b8b8b830787878787830a80d1288888888888888888888888888888888888888888888888888888888888888888888888888886311a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0301a3c3c3c3c74b8a0a0a0a030b878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787878787878787878787878a07cb830a078787878787878787878b8a881afafafaf83a87c787878787878787878787878787878787878787878a87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8281a3c32a8787878a0a07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078a0b8b8b8b830a078787878b8a80384888888888888888888888888888888888888888888888888888888888888888888888888888888b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b86b3c3c3c3c3c28b8a0a0a0a07c78787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878787878787878787878b87cb8a078787878787878787878b8a880afafafaf80a8a07878787878787878787878787878787878787878a0a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b03c3c30a0787878a07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca078b8b8b8b8b8b87878787878a89584888888888888888888888888888888888888888888888888888888888888888888888888886364a87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a037173c3c3c3c21b8a0a0a0a0b83078787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878787878787878787c30a078787878787878787878a0a8b8afafafaf377c787878787878787878787878787878787878787878a87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8063ca0b8787878a07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878b830b8b830a078787878a8408488888888888888888888888888888888888888888888888888888888888888888888888888616ca830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030043c3c3c3c1a7ca0a0a0a0b8a078787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878787878787878787878787878787878a0a8a07878787878787878787878a8a8afafaf82a8a0787878787878787878787878787878787878787830a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca83874a8787878a07878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca078a03030b8b8b8787878783075128888888888888888888888888888888888888888888888888888888888888888888888888888a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a93c3c3c3c29a8a0a0a0a0307878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787878a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878787878787878787878787878b8b87878787878787878787878a8a8afafaf80a87878787878787878787878787878787878787878b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a8b8a030787878a07878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878b87cb8b83078787878b87c1288888888888888888888888888888888888888888888888888888888888888888888888888123030b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8283c3c3c3c3c6db8a0a0a0b83078787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca0787878787878a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878787878787878787878787878787878a078787878787878787878787ca8afafafb8a078787878787878787878787878787878787878a0a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0b8a8b87c787878a07878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca078a07cb8b830a0787878a0a8648888888888888888888888888888888888888888888888888888888888888888888888886329954030a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8363c3c3c3c3c6bb8a0a0a037b878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787830a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878787878787878787878787878787878787878787878787878787878787878b8a8afaf83a878787878787878787878787878787878787878787ca8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a8b87ca07878a07878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878783030b8b8a0787878a0a80d848888888888888888888888888888888888888888888888888888888888888888888888886c6474a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8293c3c3c3c1a7ca0a0a0a0a8a078787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878787878787878787878787878787878787878787878787878787878b8a8afaf6eb8787878787878787878787878787878787878787830a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0b87cb8a87878a07878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878b830b8b8b878787878a859848888888888888888888888888888888888888888888888888888888888888888888888886c846ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8053c3c3c3c29a8a0a0a0b8a878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b8787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878787878787878787878787878787878787878787878787878787878787878a0a8afafa0787878787878787878787878787878787878787878a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0b8b8a8b878a07878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787cb8b8b878787878a87364888888888888888888888888888888888888888888888888888888888888888888888864038402a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8323c3c3c3c1130a0a0a037b87878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878787878787878787878787878787878787878787878787878787878787878787830af83b87878787878787878787878787878787878787878a0a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8a0b83030a878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0a07878b8b8b8b8787878787c73748888888888888888888888888888888888888888888888888888888888888888888863b16484b1a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a03c3c3c3c3cb8b8a0a0a0a8a0787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7878787878787878787878787878787878787878787878787878787878787878787878787878b8af17b878787878787878787878787878787878787878787ca8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a8b8a8a078787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878a030b8b87878787830a8b8b16388888888888888888888888888888888888888888888888888888888888888888864128864a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b86d3c3c3c3c1aa8a0a0a0b8a878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787830a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878787878787878787878787878787878787878787878787878787878787878787878a0afa0a078787878787878787878787878787878787878a0a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8a0b8b87c7c78787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787830b8b878787878b8a830a088888888888888888888888888888888888888888888888888888888888888888888888888127cb8a0a0a0a0a0a0a0a0a0a0a0a0a037073c3c3c3c17a8a0a0a07c30787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878787878787878787878787878787878787878787878787878787878787878787878a08b3078787878787878787878787878787878787878787ca8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8a0b8b86ba8a07878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878b8b8b878787878b8a8b8a83b618888888888888888888888888888888888888888888888888888888888888888888888887cb8a0a0a0a0a0a0a0a0a0a0a0a0a030053c3c3c3c6bb8a0a0a0a8a0787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c787878787878787878787878787878787878787878787878787878787878787878787878787878a0827c78787878787878787878787878787878787878b8a8b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0b80b5a7c78787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878b8b8b878787878a0a8b8a87c128888888888888888888888888888888888888888888888888888888888888888888888885a30a0a0a0a0a0a0a0a0a0a0a0a0a0b8a93c3c3ca97cb8a0a0a0a87878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c787878787878787878787878787878787878787878787878787878787878787878787878787878786eb8787878787878787878787878787878787878787ca8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0b8080ba8a0787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878a030b878787878a0a8b8b8a874638888888888888888888888888888888888888888888888888888888888888888888888a0a8a0a0a0a0a0a0a0a0a0a0a0a0b8a03c3c3c3c04a8a0a0a0b8a8787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a07878787878787878787878787878787878783030a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07c7ca0b8701d753078787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878b8b87878787878a8b8a030a864638888888888888888888888888888888888888888888888888888888888888888886311a8a0a0a0a0a0a0a0a0a0a0a0a0b8743c3c3c3c53a8a0a0a07cb8787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878787830a8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878787878787878787878787878787878787878787878787878787878787878787c787878787878787878787878787878787878b8a8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b87ca0a0b81d08a878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878b8a07878787878a8b8a0a0a840638888888888888888888888888888888888888888888888888888888888888888886195a8a0a0a0a0a0a0a0a0a0a0a0a0a8293c3c3c3c6bb8a0a0a0a8a078787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878787878787878787878787878787878787878787878787878787878787878787830787878787878787878787878787878787878a8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8b8a0b83a1d73b878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878a0a07878787878a830a0a0b8a8b16388888888888888888888888888888888888888888888888888888888888888886115a8a0a0a0a0a0a0a0a0a0a0a0a0a8053c3c3c1aa8a0a0a0b8a8787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b830307878787878787878787878787878787878787878787878787878787878787878787878787878787878b878787878787878787878787878787878787ca8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0b88d3aa878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878a0787878787878a87ca0a0a0a8a088888888888888888888888888888888888888888888888888888888888888888861b1a8a0a0a0a0a0a0a0a0a0a0a0b8b8a93c3c3c07a8a0a0a0b8a8787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a078787878787878a830b8b8b8b8b8b8b8b8b8b8b8b87cb87878787878787878787878787878787878787878787878787878787878787878787878787878787878a078787878787878787878787878787878b8a8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0b80b8d7cb87878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878a07878787878787ca8a0a0a0b8a8b1618888888888888888888888888888888888888888888888888888888888888888b1a8a0a0a0a0a0a0a0a0a0a0a0b8b03c3c3c3c2830a0a0a030a8787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878a87cb8b8b8b8b8b8b8b8b8b8b8b8a8b87878787878787878787878787878787878787878787878787878787878787878787878787878787878a0787878787878787878787878787878a0a8b8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0b8183135a878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878a07878787878787ca8a0a0a0a0a86b886388888888888888888888888888888888888888888888888888888888646412647ca0a0a0a0a0a0a0a0a0a0a0a8b13c3c3ca97cb8a0a0a0a87c78787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787ca8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a87cb8b8b87ca8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a06b8d1da8a07878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878b8a8a0a0a0a0b8a8a0646388888888888888888888888888888888888888888888888888b1b16488888830a0a0a0a0a0a0a0a0a0a0a030993c3c3c3ea8a0a0a0a0a8b87878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a8b8b8b8b8a8a837a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0b88a8d753078787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878b8a8a0a0a0a0a0a8a8a06463888888888888888888888888888888888888888888886415648888888888b8b8a0a0a0a0a0a0a0a0a0b86b3c3c3c3c6da8a0a0a0a0a8b87878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8a8b878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a8b8b8b8b8a8307c30a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0b83a8d3aa8a078787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878b8a8a0a0a0a0a0b8a8a86b6463888888888888888888888888888888888888888815b1888888888888886bb8a0a0a0a0a0a0a0a0a037743c3c3c21b8b8a0a0a0b8a8a07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8a8b8787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a8b8b8b8b8b8a8a07cb8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a0a0a0a0b86b8d1db8b8787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878787878b8a8a0a0a0a0a0a0a87cb8b86c1288616388888888888888888888888888888815646388888888618888a0b8a0a0a0a0a0a0a0a0a0a8b13c3c3c05a8a0a0a0a0b8a8a07878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878a830b8b8b8b8b8b8b8b8b8b8b8a8b878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a8b8b8b8b8b8a830a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca0a0a0a0a07c1d8d08a8a078787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878a0a8b8a0a0a0a0a0b8a8b8a0b8a0b03bb16412888863616163636363636388b18861636361881215406bb8a0a0a0a0a0a0a0a0a0a07c993c3c3c17a8a0a0a0a0b8a878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878a87cb8b8b8b8b8b8b8b8b8b8b8a8b8787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a8b8b8b8b8b830a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0a0a0a0a0373a8d8d73a87878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878a0a8b8a0a0a0a0a0a0a8a8a0a0a0b8b8b8b86b6ba011956c15b1b164646464641264b11595a07ca8a8b8a8a0a0a0a0a0a0a0a0a0b8a03c3c3c3c6bb8a0a0a0a030a87878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8a8b87878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a8b8b8b8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0a0a0a0a0b8758d8d0ba8a07878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878a0a8b8a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0b8b8b830a8a8a8a8a8a8a8a87c7ca8a8a8a8a8b8a0a0a0a8a0a0a0a0a0a0a0a0a030063c3c3c1aa8a0a0a0a0a07c7c7878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787ca8b8b8b8b8b8b8b8b8b8b8b8a8b878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a830b8b8b8b8b87ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a07c1d8d8d75a8787878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b87878787878787878a0a8b8a0a0a0a0a0a0a0a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8b8b8a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a07c1a3c3c3c06a8a0a0a0a0a0a8b87878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8a8b878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a830b8b8b8b8b8b8a87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0373a8d8d0ba8b8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878a0a8b8a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0307ca0a0a0a0a0a0a0a0b86b3c3c3c3ca030a0a0a0a0a0a8b8787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8a8b87878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787ca830b8b8b8b8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0b86b8d8d1d5ca8b8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8a07878787878787878a0a8b8a0a0a0a0a0a0a0a0a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a030173c3c3c99a8b8a0a0a0a0a0a8a078787878a07cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8a8b87878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a830b8b8b8b8b8b8b87ca8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0738a8d8d087c7cb87878787878787878a0b8b8b8b8b8b8b8b8b8b8b830a07878787878787878a0a8b8a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a8053c3c3c06a8a0a0a0a0a0a0a87878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8a8b878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a830b8b8b8b8b8b8b8b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0b83a8d8d1d5ca8b8a07878787878787878a0b8b8b8b8b8b8b8b8b8b830a07878787878787878a0a8b8a0a0a0a0a0a0a0a0a030a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0b86b3c3c3c3c6b37a0a0a0a0a0b8a87878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878a0a830b8b8b8b8b8b8b8b8b8b8a8307878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787ca8b8b8b8b8b8b8b8b8b8b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b87ca0a0a0a0a0a0a0b8701d8d8d087330a078787878787878787830b8b8b8b8b8b8b8b8b830a07878787878787878a0a8b8a0a0a0a0a0a0a0a0a0a0a87cb8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0307ca0a0a0a0a0a0a0a030523c3c3c1aa8a0a0a0a0a0a0b8a87878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878a0a830b8b8b8b8b8b8b8b8b8b87c307878787878787878787878787878787878787878787878787878787878787878787878787878787878787878307cb8b8b8b8b8b8b8b8b8b8b87ca8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b837a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0307ca0a0a0a0a0a0a0a0400b8d8d1d70a8b8787878787878787878a030b8b8b8b8b8b8b8b830a07878787878787878a0a8b8a0a0a0a0a0a0a0a0a0a0b8a86d74b8b8b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a07c1a3c3c3c17a8a0a0a0a0a0a07ca8787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07ca0787878787878a830b8b8b8b8b8b8b8b8b8b8307c787878787878787878787878787878787878787878787878787878787878787878787878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b830a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b87cb8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0307ca0a0a0a0a0a0a0a040088d8d8d0875a8b8787878787878787878b830b8b8b8b8b8b8b830a07878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0376b2132b11728a06bb8b8b8a0a0a0a0a0a0b8b8b8b830a8a074a8a0a0a0a0a0a0a0a0b8a03c3c3c21b8b8a0a0a0a0a037a830787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a07ca0787878787878a87cb8b8b8b8b8b8b8b8b8b8307c7878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07c30a0a0a0a0a0a0a0a0a00c1d8d8d8d1b5ca8a0787878787878787878b8b8b8b8b8b8b8b830a07878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a8173c3c3c3c21321ab117a0b8b8b86ba0286d1706b1052104a8a0a0a0a0a0a0a0a0a8b13c3c3c3ea8a0a0a0a0a037a819b878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87830a0787878787878a87cb8b8b8b8b8b8b8b8b8b8b87ca07878787878787878787878787878787878787878787878787878787878787878787878787878787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a06b0b8d8d8d8a5c0ca8787878787878787878a0b8b8b8b8b8b8b830787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a81a3c3c3c3c3c3c3c3c21a93232a9213c3c3c3c3c3c3c6da8a0a0a0a0a0a0a0b8b8213c3c3c28a8a0a0a0a030a80b70b878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878b8b8787878787878a8a8b8b8b8b8b8b8b8b8b8b8b87ca07878787878787878787878787878787878787878787878787878787878787878787878787878787878307cb8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0b8188d8d8d8d083a0ca8787878787878787878a0b8b8b8b8b8b8b87878787878787878787ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a03c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3cb8b8a0a0a0a0a0a0a0a8363c3c3c1aa8b8a0a0a0a87c8a8db8b878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878b8b8787878787878a8a8b8b8b8b8b8b8b8b8b8b8b87ca07878787878787878787878787878787878787878787878787878787878787878787878787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a06b1d8d8d8d8d080b757c787878787878787878b8b8b8b8b8b8b8787878787878787878a87cb8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8533c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3ca9b1a8a0a0a0a0a0a0a0a0a8993c3c3c74a8a0a0a0a8731d8d8d73b878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878a0b8787878787878a8a8b8b8b8b8b8b8b8b8b8b8b87cb87878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a830b8b8b8b8b8b8b8b8b8b8b8b8b8a8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0b8a0a0b80b8d8d8d8d1d0c8aa8b878787878787878a0a0b8b8b8b8b8b8787878787878787878a852b0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a801323c3c3c3c3c3c3c3c3c3c3c3c3c21b1b0a0307ca0a0a0a0a0a0a030113c3c3c99a8b8a0a0a8750d8d8d8d73b878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878a0b87878787878787ca8b8b8b8b8b8b8b8b8b8b8b830b8787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a8a8b8a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0b8b8a0a0a0408d8d8d8d8d0b3a0ba8a078787878787878b8b8b8b8b8b8a07878787878787878a0a81a99b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b0b1993c3c3c3c3c3c3c3c993e74b8a8b8a0a8b8a0a0a0a0a0a0a0a81a3c3c3c6da8a0a0a81b8d8d8d8d8d73a078787878b8b8b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878a07878787878787ca8b8b8b8b8b8b8b8b8b8b8b830307878787878787878787878787878787878787878787878787878787878787878787878787878787878787ca8b8b8b8b8b8b8b8b8b8b8b8b8b87ca8a8a8a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0b8a0a0a0a0b88a8d8d8d8d8d350b1ba878787878787878a030b8b8b830a07878787878787878b87c213c0730a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a87cb8b05407b138066da030a837b8a0a0b8a8a0a0a0a0a0a0a030b03c3c3c05a8a0b8a83a8d8d8d8d8d8d73a07878787830b8b830a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878a078787878787830a8b8b8b8b8b8b8b8b8b8b8b83030a07878787878787878787878787878787878787878787878787878787878787878787878787878787878b8a87cb8b8b8b8b8b8b8b8b8b8b8b87ca8a8a8a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0b8a0a0a0a0a0408d8d8d8d8d8d0c0b73b878787878787878b830b8b830787878787878787878a8283c3c3c6da8a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8b8a0b8b8b8b8b8b8b8a0a0a0a0a0a030a8a0a0a0a0a0a0a0a8993c3c216b30b8a80b8d8d8d8d8d8d8d7ca07878787830b8b8b878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878a078787878787830a8b8b8b8b8b8b8b8b8b8b8b83030a07878787878787878787878787878787878787878787878787878787878787878787878787878787878b8a8a8b8b8b8b8b8b8b8b8b8b8b8b830a8a837a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca8a0a0a0a0a0a0b8b8a0a0a0a0a0b80b8d8d8d8d8d1d3a08a8a0787878787878a07cb8b8b8787878787878787878a80a3c3c3c3c6da8a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a8543c3c3c53a837751d8d8d8d8d8d8d8d8d7ca07878787830b830a078b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878a078787878787830a8b8b8b8b8b8b8b8b8b8b8b83030b8787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a8b8a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a830a0a0a0a0a0a0b8a0a0a0a0a0a0a06b0b8d8d8d8d8d8a0875a87878787878787830b8b8b87878787878787878a0a8053c3c3c3c3cb0a8a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8b8a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0b8a03c3c3c3ea8a81b8d8d8d8d8d8d8d8d8d8d7ca0787878787cb830a078b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787878787830a8b8b8b8b8b8b8b8b8b8b8b8b83030787878787878787878787878787878787878787878787878787878787878787878787878787878787878b8a8a8b8b8b8b8b8b8b8b8b8b8b87ca830a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a8108d8d8d8d8d8a35a8b8787878787878b830b8b87878787878787878b8a8043c3c3c3c3c3c6da8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a830a0a0a0a0a0a0a0a0a0a0377ca0a0a0a0a0b86b323c3c05a8a8088d8d8d8d8d8d8d8d8d8d8d7ca0787878787cb8307878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878787ca8b8b8b8b8b8b8b8b8b8b8b8b87c30787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a8b8b8b8b8b8b8b8b8b8b87ca830a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0b8a8188d8d8d8d8d0b75a8787878787878a0b830a078787878787878787ca8b83e3c3c3c3c3c3c29b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a8b8a0a0a0a0a0a0a0a030a0a0a0a0a0b8b81a3c3c0430738a8d8d8d8d8d8d8d8d8d8d8d8d73a07878787830b8307878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878787ca8b8b8b8b8b8b8b8b8b8b8b8b87c7ca0787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a87cb8b8b8b8b8b8b8b8b8a87ca0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0b8a8088d8d8d8d8d08a8b87878787878a0b830a07878787878787878a8b8a0b817613c3c3c3c3c321137a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a8b8a0a0a0a0a0a0b8b8a0a0a0a0b8b8053c210aa8751d8d8d8d8d8d8d8d8d8d8d8d8d1d7ca07878787830b8b87878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b83030b878787878787878787878787878787878787878787878787878787878787878787878787878787878787830a8a8b8b8b8b8b8b8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a030a80b8d8d8d8d8d5ca87878787878a0b8b87878787878787878a0a8b8a0a0b86bb1213c3c3c3c3c297cb8a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0b8a0a0a0a0b8b81a3c04b0a8708d8d8d8d8d8d8d8d8d8d8d8d8d1d40a8a078787878b830a07878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b83030b8787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a830b8b8b8b8b8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a830a0a0a0a0a030a0a0a0a0a0a0a0a0a0a0a0a0a0a87c1d8d8d8d8d1da8b8787878787830b8787878787878787830a8a0a0a0a0b87c6b29213c3c3c3c046b30a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0b8b8b8a01a3c52b8b8358d8d8d8d8d8d8d8d8d8d8d8d8d0ba0a0a8b878787878b830a07878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b8b87ca078787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a8a8b8b8b8b8b8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a07c7ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca8a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8731d8d8d8d8d0ca8787878787830a078787878787878b8a837a0a0a0a0a0a0b8a8b8293c3c3c3c2153a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0b8a8a8a8a8a8a8a0a0b8118a8d8d8d8d8d8d8d8d8d8d8d8d0b70b8a0a0a8b878787878b830787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878a87cb8b8b8b8b8b8b8b8b8b8b8b8b8a8a078787878787878787878787878787878787878787878787878787878787878787878787878787878787878b8a8a830b8b8b8b8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a830a0a0a0a0a030a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8731d8d8d8d8aa8a07878787830a078787878787878a8a830b8a0a0a0a0a0a0a0b8a8a0993c3c3c3c056ba8a0a0a0a0a0a0a0a0a0a0a0a0a0a030a87c5c080b0b1d0b5ca8b81d8d8d8d8d8d8d8d8d8d8d8d0b5ca8b8a0a0a0a8b878787878b83078787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878a87cb8b8b8b8b8b8b8b8b8b8b8b8b87cb878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a8a8b8b8b8b8b8b830a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8a0a0a0a0a030b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a87c8a8d8d8d75a878787878307878787878787878a8730b6b30b8a0a0a0a0a0a0b8a87c063c3c3c3c2117a837a0a0a0a0a0a0a0a0a0a0a8a87c3a0d8d8d8d8d8d8d8d8a3a700b8a0b0b8a0b0b0b3a7073a837a0a0a0a0a0a8b878787878a030787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b87c787878787878787878787878787878787878787878787878787878787878787878787878787878787878787830a8a8b8b8b8b8b8b830a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0b830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8080e1d08a878787878b878787878787878a0a835318d0b75a8b8a0a0a0a0a0a0b8a86da93c3c3c3c1a11b8b8a0a0a0a0a0a0a8a8700b0d8d8d8d8d8d8d8d8d8d0d8d1d75a8b8b8b8b8303037b8b8a0a0a0a0a0a0a07c3078787878a0b8787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a0787878787878787878a0a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a078787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a87cb8b8b8b8b87ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8a0a0a0a0a07ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca875180ba8a0787878a078787878787878b8a81d8d8d8d8d0b75a837b8a0a0a0a0b8a8a0b1a93c3c3c3ca906a0a0a0a0377c0c1d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d73b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a878787878a0b878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787ca8a8b8b8b8b8b87ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a8a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a818757c7878a078787878787878787c1b8d8d8d8d8d8d8d0b707ca8a8b8b8a0b8b8b8a0a0a028b0362954a0a87c351d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d1ba8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a878787878a0a078787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a87878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a87cb8b8b8b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a87ca87878a078787878787878a0a80b8d8d8d8d8d8d8d8d8d1d0e1b7573736bb8373737b8b8b8b8b8b87c181d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d1ba8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b83078787878787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a8a8b8b8b8b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a8a0787878787878787878b8738d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d1d085c73a8a830b837750b8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d70a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878787ca8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830307878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a830b8b8b8a87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a830a0a0a03730a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8307878787878787878a0a80c8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8a0b081835358d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d7537a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a878787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a8a87cb8b8b8a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca8b8a0a0b87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a87878787878787878b8a80b8d8d8d8d8d8d8d8d8d8d1d0b8a1d8d8d8d8d8d8d8d8d8d8d0b5c0b8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d73b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a07878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830307878787878787878787878787878787878787878787878787878787878787878787878787878787878787878a0a8a8b8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a8b8a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a07878787878787830738d8d8d8d8d8d8d8d8d8d8d8d1d8a0b3a3a080b0b0b08081873a8088d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d1da8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a07878787878787878b830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878a0a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a078787878787878787878787878787878787878787878787878787878787878787878787878787878787878787ca830b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b830a0a0a0a0a0a0a0a0a0a0a0a0a0b830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b83730a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8787878787878a0a83a8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d1d0b080c1b5c73a8a8a80b8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d08a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b87878787878787878a030b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8787878787878787878b8a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307c7878787878787878787878787878787878787878787878787878a07878787878787878787878787878787878a0a8a8b8b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07cb8a0a0a0a0a0a0a0a0a0a0a0a0a07ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a830787878787878b8a80c8a8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8a081b73a87cb8a0a8738d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d1ba8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a83078787878787878787830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a0787878787878787878b8a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8b8787878787878787878787878787878787878787878787878b8a0787878787878787878787878787878787878b8a87cb8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a87878787878a0a8a8b8b86b70183a08080b0b0b0e08083a1b757ca8a8a8b8a0a0a0a0b8a83a8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d0db8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307878787878787878787830a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a07878787878787878787878787878787878787878787878a87878787878787878787878787878787878787878a8a87ca8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8787878787830a8b8a0a0a0b8b83737a8a8a8a8a8a8a8a837b8b8a0a0a0a0a0a0a0a0a0a8a81d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d1db8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878787ca8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a878787878787878787878787878787878787878787878307c7878787878787878787878787878787878787878a0a8a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a03030a0a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0787878a0a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8708d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d0b37a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c307878787878787878787878787878787878787878a0a8b8787878787878787878787878787878787878787878a0a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a078787830a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a80b8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d3108a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a078787878787878787878a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a830787878787878787878787878787878787878a07c30b8787878787878787878787878787878787878787878787ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a07878a0a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8738d8d8d8d8d8d8d8d8d8d8a0b3a3a3a080b0b3a75a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c78787878787878787878a0a87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a87c7878787878787878787878787878787878303030a078787878787878787878787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a078787cb8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a80b8d8d8d8d1d0b35705c5c700c71707573a8750ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a830787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b878787878787878787878b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca8a07878787878787878787878787878307cb87c7878787878787878a07878787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a07830b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a83a8d1d0b0b0c0c088a8d8d8d0b8d8d8d8d0d8d8d3ab8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7878787878787878787878a830b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a87ca078787878787878787878b8a830b8b87c7878787878787878b87878787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a878b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a83a8d0b1d088a8d8d8d8d8d8d0b0b8d8d8d8d8d8d8d8a7cb8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b878787878787878787878a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830a8a830b8a0a0a0a0b8b87c7cb8b8b830b87878787878787878a87878787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b87ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a0b830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8181d0b8d088d8d8d8d8d8d8d8d188d8d8d8d8d8d8d8d0ba8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8b8b830787878787878787878787830a8b87cb8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8307ca8a8a8a87c30b8b8b8b8b87ca078787878787878a0a87878787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a035088a8d088d8d8d8d8d8d8d8d08088d8d8d8d8d8d8d8d1b37a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8787878787878787878a0b8b8b8b8b8b8b8b8b8b8b8b830a07878787878787878787878a830a0a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7878787878787878b8a87878787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b00c8d0d3a8d8d8d8d8d8d8d8d1d708d8d8d8d8d8d8d8d1da8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a878787878787878787878b8b8b8b8b8b8b8b8b8b8b8b8307878787878787878787878a0a8b8b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878787878a8a8b878787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8088d1d358d8d8d8d8d8d8d8d8d708a8d8d8d8d8d8d8d8d18a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a878787878787878787878b8b8b8b8b8b8b8b8b8b8b87c78787878787878787878787830a8a0b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87ca07878787878787878a8b87c78787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a037a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07c1d8d0b358d8d8d8d8d8d8d8d8d35088d8d8d8d8d8d8d8d1da8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0787878787878787878b8b8b8b8b8b8b8b8b8b830a0787878787878787878787878a830a0b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87c7878787878787878a0a8a0a878787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a830a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8738d8d35088d8d8d8d8d8d8d8d8d0b0c8d8d8d8d8d8d8d8d8d18a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8787878787878787878b830b8b8b8b8b8b8b830b8787878787878787878787878a0a8b8a0b8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb8787878787878787830a8787ca0787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8188d8d5c0b8d8d8d8d8d8d8d8d8d8a708d8d8d8d8d8d8d8d8d1da8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a037a878787878787878787878b8a830b8b8b8b8b8b8787878787878787878787878787ca8a0a037a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8787878787878787878a8307880a8787878787878787878787878b8a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a81d8d1d738d8d8d8d8d8d8d8d8d8d1d1b8d8d8d8d8d8d8d8d8d8d5ca8a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8a078787878787878787878a07ca87cb8b8b87878787878787878787878787878a8b8a0a030a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830b87878787878787878a0a8a07883a8787878787878787878787878b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a07ca8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0305c8d8d3a5c8d8d8d8d8d8d8d8d8d8d8d188d8d8d8d8d8d8d8d8d8d0ba8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8787878787878787878787878a0a0b8b87878787878787878787878787878b8a8b8a0a030a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a87878787878787878787ca87878afa8b87878787878787878787878b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a80b8d8d19088d8d8d8d8d8d8d8d8d8d8d3a8d8d8d8d8d8d8d8d8d8d1da8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a030a8787878787878787878787878787878787878787878787878787878787878a8a8a0a0a07ca8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b830307878787878787878a0a83078788f6fa87878787878787878787878b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8198d8d0b7c8d8d8d8d8d8d8d8d8d8d8d8d088d8d8d8d8d8d8d8d8d8d8d5c37a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a078787878787878787878787878787878787878787878787878787878a0a8b8a0a0a07ca8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8a0787878787878787830a8a078788f82a8a078787878787878787878b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b8a80b8d8d5c0c8d8d8d8d8d8d8d8d8d8d8d8d088d8d8d8d8d8d8d8d8d8d8d08a8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0303078787878787878787878787878787878787878787878787878787878b8a8a0a0a0a07ca8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b87cb87878787878787878a0a8a87878928fafa8a878787878787878787878b8a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8708d8d0b758d8d8d8d8d8d8d8d8d8d8d8d1d0b8d8d8d8d8d8d8d8d8d8d8d1d7ca0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8a0787878787878787878787878787878787878787878787878787878a87ca0a0a0a0a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a87878787878787878787ca8b878785d8f8f80a87c787878787878787878a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a8b8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b87c0d8d8d0b1d8d8d8d8d8d8d8d8d8d8d8d8d8d1d8d8d8d8d8d8d8d8d8d8d8d8d3aa0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0b87c787878787878787878787878787878787878787878787878787878b8a0a0a0a0a0a8a8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8a8b87878787878787878b8a8a87878785d"}'
        console.log(JSON.parse(tempFile))
    }

    this.save = () => {
        const output = {
            version: '1.0',
            compression: 'none',
            width: store.imageWidth,
            height: store.imageHeight,
            data: ''
        }

        store.imageConvertedHex.forEach((item, i) => {
            if (store.renderedPainted[i]) {
                output.data += this._intToDoubleHex(store.renderedPainted[i])
            } else {
                output.data += this._intToDoubleHex(item)
            }
        })


        const blob = new Blob([JSON.stringify(output)], {type: 'text/json'})
        return _URL.createObjectURL(blob)
    }

    this.convert = () => {
        const catchedBlocks = {}
        const groups = []

        for (let i = 0; i < store.imageConvertedHex.length; i++) {
            let targetPos = i

            if (catchedBlocks[targetPos]) { continue }
            catchedBlocks[targetPos] = true

            let targetBlock = store.imageConvertedHex[targetPos]
            let targetWidth = 1
            let targetHeight = 1

            while (true) {
                let tempPos = targetPos + targetWidth
                if (store.imageConvertedHex[tempPos] === targetBlock && !catchedBlocks[tempPos]) {
                    catchedBlocks[targetPos + targetWidth] = true
                    targetWidth++
                } else {
                    break
                }
                if ((targetPos + targetWidth) % store.imageWidth === 0) { break }
            }

            while (true) {
                let tempPos = targetPos + targetHeight * store.imageWidth
                if (store.imageConvertedHex[tempPos] === targetBlock && !catchedBlocks[tempPos]) {
                    catchedBlocks[targetPos + targetHeight * store.imageWidth] = true
                    targetHeight++
                } else {
                    break
                }
                if (targetPos + targetWidth * store.imageWidth < store.imageWidth) { break }
            }

            if (targetWidth === 1 && targetHeight === 1) {
                groups.push([targetPos])
                continue
            }

            let tempHeight = targetHeight
            let startBlockGroup = targetPos
            for (let w = 0; w < targetWidth; w++) {
                for (let h = 0; h < tempHeight; h++) {
                    let shiftPos = targetPos + h * store.imageWidth + w + 1
                    if (store.imageConvertedHex[shiftPos] === targetBlock) {
                        catchedBlocks[shiftPos] = true
                        if (w + 1 === targetWidth && h + 1 === tempHeight) {
                            if (startBlockGroup === targetPos + targetWidth - 1 + (tempHeight - 1) * store.imageWidth) {
                                groups.push([startBlockGroup])
                            } else {
                                groups.push([startBlockGroup, targetPos + targetWidth - 1 + (tempHeight - 1) * store.imageWidth])
                            }
                        }
                    } else {
                        if (startBlockGroup === targetPos + w + (tempHeight - 1) * store.imageWidth) {
                            groups.push([startBlockGroup])
                        } else {
                            groups.push([startBlockGroup, targetPos + w + (tempHeight - 1) * store.imageWidth])
                        }
                        startBlockGroup = targetPos + w + 1
                        tempHeight = h
                        break
                    }
                }
            }
        }

        console.log(groups.length, Object.keys(catchedBlocks).length)

        function convertPosToInGameXYZ (int, facing) {
            const pos = thisRoot._getPosFromInt(int)
            let x = pos.x + 1
            let y = store.imageHeight - pos.y - 1
            if (x === 0) { x = '' }
            if (y === 0) { y = '' }
            switch (facing) {
                case 'east':
                    return `~${x} ~${y} ~`
                    break
                case 'south':
                    return `~ ~${y} ~${x}`
                    break
                case 'west':
                    return `~${-x} ~${y} ~`
                    break
                case 'north':
                    return `~ ~${y} ~${-x}`
                    break    
            }
        }

        let facing = 'east'
        let output = ''

        groups.forEach((item) => {
            if (item.length === 1) {
                const pos = item[0]
                const gameId = store.getBlockById(store.imageConvertedHex[pos]).game_id
                const xyz = convertPosToInGameXYZ(pos, facing)
                output += `setblock ${xyz} ${gameId}\n`
            } else {
                const pos1 = item[0]
                const pos2 = item[1]
                const gameId = store.getBlockById(store.imageConvertedHex[pos1]).game_id
                const xyz1 = convertPosToInGameXYZ(pos1, facing)
                const xyz2 = convertPosToInGameXYZ(pos2, facing)
                output += `fill ${xyz1} ${xyz2} ${gameId}\n`
            }
        })

        // groups.forEach((item) => {
        //     if (item.length === 1) {
        //         const pos = this._getPosFromInt(item[0])
        //         ctxMain.fillStyle = "red"
        //         ctxMain.fillRect(
        //                       pos.x * store.baseCellSize * store.scale.current + store.offset.x,
        //                       pos.y * store.baseCellSize * store.scale.current + store.offset.y,
        //                       store.scale.current * store.baseCellSize,
        //                       store.scale.current * store.baseCellSize)
        //     } else {
        //         const startPos = this._getPosFromInt(item[0])
        //         const endPos = this._getPosFromInt(item[1])
        //         ctxMain.strokeRect(
        //                       startPos.x * store.baseCellSize * store.scale.current + store.offset.x,
        //                       startPos.y * store.baseCellSize * store.scale.current + store.offset.y,
        //                       (endPos.x - startPos.x + 1) * store.scale.current * store.baseCellSize,
        //                       (endPos.y - startPos.y + 1) * store.scale.current * store.baseCellSize)
        //     }
        // })

        const blob = new Blob([output], {type: 'text/plain'})
        return _URL.createObjectURL(blob)
    }

    this.render = () => {
        this._renderMainCanvas()
        this._renderOverlayCanvas()
    }

    this.init = function() {
        $root.style.position = 'relative'
        canvasMain.style.position = 'absolute'
        canvasOverlay.style.position = 'absolute'
        canvasMain.width = store.canvasWidth
        canvasMain.height = store.canvasHeight
        canvasOverlay.width = store.canvasWidth
        canvasOverlay.height = store.canvasHeight
        $root.appendChild(canvasMain)
        $root.appendChild(canvasOverlay)

        ctxMain.imageSmoothingEnabled = false
        this._setEventListeners()
    }

    this.init()
}

export default MineartCanvas
