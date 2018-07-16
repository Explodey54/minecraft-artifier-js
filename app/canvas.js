function MineartCanvas() {
    var $root

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
        imageWidth: null,
        imageHeight: null,
        canvasWidth: null,
        canvasHeight: null,
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
            $root.dispatchEvent(store.events.cached)
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
        $root.dispatchEvent(event)
    }

    this._undoBack = (pos) => {
        for (let i = store.history.currentPos; i > pos; i += -1) {
            const logStep = store.history.log[i]
            for (let key in logStep.data.before) {
                let xBlock = key % store.imageWidth
                let yBlock = Math.floor(key / store.imageWidth)
                if (logStep.data.before[key] === 0) {
                    this._fakePaint(xBlock, yBlock, 0)
                } else {
                    this._fakePaint(xBlock, yBlock, logStep.data.before[key])
                    let imageForCanvas = store.getBlockById(logStep.data.before[key]).image
                }
                store.imageConvertedHex[key] = logStep.data.before[key]
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
                store.imageConvertedHex[key] = logStep.data.current[key]     
            }
        }
    }

    this._undoTo = (pos) => {
        pos = parseInt(pos)
        if (pos === store.history.currentPos) { return }

        // if (pos === -1) {
        //     ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)
        //     ctxTemp.drawImage(store.blobImage, 0, 0)
        //     this._renderMainCanvas()
        // } else {
            if (store.history.currentPos - pos > 0) {
                this._undoBack(pos)
            } else {
                this._undoForward(pos)
            }
        // }

        store.history.currentPos = pos
    }

    this._convertToGroups = () => {
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
        groups.forEach((item) => {
            if (item.length === 1) {
                const pos = this._getPosFromInt(item[0])
                ctxMain.fillStyle = "red"
                ctxMain.fillRect(
                              pos.x * store.baseCellSize * store.scale.current + store.offset.x,
                              pos.y * store.baseCellSize * store.scale.current + store.offset.y,
                              store.scale.current * store.baseCellSize,
                              store.scale.current * store.baseCellSize)
            } else {
                const startPos = this._getPosFromInt(item[0])
                const endPos = this._getPosFromInt(item[1])
                ctxMain.strokeRect(
                              startPos.x * store.baseCellSize * store.scale.current + store.offset.x,
                              startPos.y * store.baseCellSize * store.scale.current + store.offset.y,
                              (endPos.x - startPos.x + 1) * store.scale.current * store.baseCellSize,
                              (endPos.y - startPos.y + 1) * store.scale.current * store.baseCellSize)
            }
        })

        return groups

        // let facing = 'east'
        // let output = ''

        // groups.forEach((item) => {
        //     if (item.length === 1) {
        //         const pos = item[0]
        //         const gameId = store.getBlockById(store.imageConvertedHex[pos]).game_id
        //         const xyz = convertPosToInGameXYZ(pos, facing)
        //         output += `setblock ${xyz} ${gameId}\n`
        //     } else {
        //         const pos1 = item[0]
        //         const pos2 = item[1]
        //         const gameId = store.getBlockById(store.imageConvertedHex[pos1]).game_id
        //         const xyz1 = convertPosToInGameXYZ(pos1, facing)
        //         const xyz2 = convertPosToInGameXYZ(pos2, facing)
        //         output += `fill ${xyz1} ${xyz2} ${gameId}\n`
        //     }
        // })

        // const blob = new Blob([output], {type: 'text/plain'})
        // return _URL.createObjectURL(blob)
    }

    this._convertGroupToCommand = (group, facing) => {
        const gameId = store.getBlockById(store.imageConvertedHex[group[0]]).game_id
        const output = []
        group.forEach((item) => {
            const pos = thisRoot._getPosFromInt(item)
            let x = pos.x + 1
            let y = store.imageHeight - pos.y - 1
            if (x === 0) { x = '' }
            if (y === 0) { y = '' }
            switch (facing) {
                case 'east':
                    output.push(`~${x} ~${y} ~`)
                    break
                case 'south':
                    output.push(`~ ~${y} ~${x}`)
                    break
                case 'west':
                    output.push(`~${-x} ~${y} ~`)
                    break
                case 'north':
                    output.push(`~ ~${y} ~${-x}`)
                    break    
            }
        })
        if (output.length === 1) {
            return `setblock ${output[0]} ${gameId}`
        } else {
            return `fill ${output[0]} ${output[1]} ${gameId}`
        }
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
                    history.before[i] = store.imageConvertedHex[i]
                    store.imageConvertedHex[i] = tempFakePaintedPoints[i]
                }
                thisRoot._addToHistory(thisRoot.getTool(), history)
                tempFakePaintedPoints = {}
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
                            hexBlock = store.imageConvertedHex[y * store.imageWidth + x]
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

    this.setBoundingRect = () => {
        store.boundingRect = $root.getBoundingClientRect()
        store.canvasWidth = store.boundingRect.width
        store.canvasHeight = store.boundingRect.height
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
            let temp = Object.assign({}, item)
            temp.image = new Image()
            temp.image.src = temp.src
            delete temp.src
            store.blocksDb.push(temp)
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
            if (store.interface.selection.start !== null && store.interface.selection.end !== null) {
                if (!this._checkIfInSelection(i)) { continue }
            }

            if (store.imageConvertedHex[i] === target) {
                let xBlock = i % store.imageWidth
                let yBlock = Math.floor(i / store.imageWidth)
                history.before[i] = store.imageConvertedHex[i]
                history.current[i] = replace
                store.imageConvertedHex[i] = replace
                thisRoot._fakePaint(xBlock, yBlock, replace)
            }
        }

        this._addToHistory('replace', history)
        return Object.keys(history.current).length
    }

    this.reset = () => {
        store.imageConvertedHex = null
        store.blobImage = new Image()
        store.offset.x = 0
        store.offset.y = 0
        store.scale.current = 0.0625
        store.history.log = []
        store.history.currentPos = -1
        store.history.lastMaxPos = -1
        store.interface.eyedropCurrent = 44
        store.interface.toolCurrent = 'pencil'
        store.interface.brushSize = 9
        store.interface.selection.start = null
        store.interface.selection.end = null
    }

    this.open = (uint8Arr) => {
        // let tempFile = require('../static/pepe.json')
        // if (tempFile.data.length / 2 !== tempFile.width * tempFile.height) {
        //     throw new Error('Data length in file is incorrect')
        // }
        // let imageConvertedHex = new Uint8ClampedArray(tempFile.data.length / 2)
        // for (let i = 0; i < tempFile.data.length; i+= 2) {
        //     const int = parseInt(tempFile.data.charAt(i) + tempFile.data.charAt(i + 1), 16)
        //     imageConvertedHex[i / 2] = int
        // }

        this.reset()
        // this.setImageSizes(tempFile.width, tempFile.height)
        this.loadImageHex(uint8Arr)
        this.render()
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
            output.data += this._intToDoubleHex(item)
        })


        const blob = new Blob([JSON.stringify(output)], {type: 'text/json'})
        return _URL.createObjectURL(blob)
    }

    this.convertAsMcfunction = (facing) => {
        const groups = this._convertToGroups()
        let output = ""
        groups.forEach((item) => {
            output += this._convertGroupToCommand(item, facing) + "\n"
        })

        console.log(output)
    }

    this.convertAsCommandBlock = (facing) => {
        const commandTemplate = 'summon falling_block ~ ~1 ~ %replace%'

        const outsideTemplate = `
        {
            Block:activator_rail,
            Time:1,
            Passengers:[%replace%]
        }`

        const passengerTemplate = `
        {
            id: "commandblock_minecart",
            Command: "%command%",
            Passengers: [%passenger%]
        }
        `

        const groups = this._convertToGroups().slice(0, 325)
        let output = passengerTemplate.replace(/\n|\s/g, '')

        groups.forEach((item, i) => {
            const command = this._convertGroupToCommand(item, facing)
            output = output.replace('%command%', command)
            if (i !== groups.length - 1) {
                output = output.replace('%passenger%', passengerTemplate.replace(/\n|\s/g, ''))
            } else {
                output = output.replace('%passenger%', '')
            }
        })

        const temp = outsideTemplate.replace(/\n|\s/g, '').replace('%replace%', output)

        console.log(commandTemplate.replace('%replace%', temp))
        console.log(commandTemplate.replace('%replace%', temp).length)
    }

    this.render = () => {
        this._renderMainCanvas()
        this._renderOverlayCanvas()
    }

    this.init = function(rootNode) {
        $root = rootNode
        $root.style.position = 'relative'
        canvasMain.style.position = 'absolute'
        canvasOverlay.style.position = 'absolute'
        this.setBoundingRect()
        canvasMain.width = store.canvasWidth
        canvasMain.height = store.canvasHeight
        canvasOverlay.width = store.canvasWidth
        canvasOverlay.height = store.canvasHeight
        $root.appendChild(canvasMain)
        $root.appendChild(canvasOverlay)

        ctxMain.imageSmoothingEnabled = false
        this._setEventListeners()
    }
}

export default MineartCanvas
