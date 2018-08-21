function MineartCanvas() {
    var $root

    const canvasMain = document.createElement('canvas')
    const ctxMain = canvasMain.getContext('2d')

    const canvasOverlay = document.createElement('canvas')
    const ctxOverlay = canvasOverlay.getContext('2d')

    const canvasTemp = document.createElement('canvas')
    const ctxTemp = canvasTemp.getContext('2d')

    const canvasInit = document.createElement('canvas')
    const ctxInit = canvasInit.getContext('2d')

    const _URL = window.URL || window.webkitURL

    const thisRoot = this

    const store = {
        blocksDb: [],
        getBlockById(id) { return this.blocksDb[id - 1] },
        initFlag: false,
        imageConvertedHex: null,
        imageConvertedHexBackup: null,
        imageWidth: null,
        imageHeight: null,
        canvasWidth: null,
        canvasHeight: null,
        baseCellSize: 16,
        boundingRect: null,
        originalImage: new Image(),
        groups: null,
        offset: {
            bounds: {
                x: null,
                y: null
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
            lastMaxPos: -1,
            maxStates: 50,
            offset: 0
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
            maxBrushSize: 25,
            showGrid: false,
            showRulers: true,
            showOriginal: false,
            showDebugDrawGroups: true,
            minecraftVersion: 12,
            drawGroupsCurrent: 0
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
            savedStartHistory: null,
            drawGroups: []
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
        let bottomRightY = Math.floor((store.canvasHeight - store.offset.y) / store.baseCellSize / store.scale.current) + 1

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
        if (store.interface.selection.start === null || store.interface.selection.start === null) { return true }
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
            if (store.imageConvertedHex[i] > 0) {
                let imageForCanvas = store.getBlockById(store.imageConvertedHex[i]).image
                ctxTemp.drawImage(imageForCanvas,
                                 x * store.baseCellSize,
                                 y * store.baseCellSize,
                                 store.baseCellSize,
                                 store.baseCellSize)
                ctxInit.drawImage(imageForCanvas,
                                 x * store.baseCellSize,
                                 y * store.baseCellSize,
                                 store.baseCellSize,
                                 store.baseCellSize)
            }
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

    this._bucket = (x, y, id) => {
        if (x < 0 || y < 0) { return }
        if (x >= store.imageWidth || y >= store.imageHeight) { return }
        const startPos = this._getIntFromPos(x, y)
        if (!thisRoot._checkIfInSelection(startPos)) { return }

        const startId = store.imageConvertedHex[startPos]
        const tempArr = [startPos]
        const history = {
            current: {},
            before: {}
        }

        for (let i = 0; i < tempArr.length; i++) {
            let offsets = [
                {x: 0, y: 0},
                {x: 0, y: store.imageWidth},
                {x: 0, y: -store.imageWidth}
            ]
            if (tempArr[i] % store.imageWidth !== 0) {
                offsets.push({x: -1, y: 0})
            }
            if ((tempArr[i] + 1) % store.imageWidth !== 0) {
                offsets.push({x: 1, y: 0})
            }

            offsets.forEach((item) => {
                let posOffset = tempArr[i] + item.x + item.y
                if (store.imageConvertedHex[posOffset] === startId && history.current[posOffset] === undefined && thisRoot._checkIfInSelection(posOffset)) {
                    history.current[posOffset] = id
                    history.before[posOffset] = store.imageConvertedHex[posOffset]
                    store.imageConvertedHex[posOffset] = id
                    const pos = thisRoot._getPosFromInt(posOffset)
                    thisRoot._fakePaint(pos.x, pos.y, id)
                    tempArr.push(posOffset)
                }
            })
        }
        thisRoot._addToHistory('bucket', history)
    }

    this._addToHistory = (type, data) => {
        for (let i = store.history.currentPos; i < store.history.lastMaxPos; i++) {
            store.history.log.shift()
        }

        if (store.history.currentPos === -1) {
            store.history.offset = 0
        }

        if (store.history.log.length === store.history.maxStates) {
            store.history.log.shift()
            store.history.offset++
        }

        store.history.currentPos++
        store.history.lastMaxPos = store.history.currentPos
        store.history.log.push({
            type: type,
            data: data
        })
        
        const event = store.events.history
        event.details = {
            pos: store.history.currentPos,
            type: type
        }
        $root.dispatchEvent(event)
    }

    this._undoBack = (pos) => {
        pos += -store.history.offset
        const tempSum = {}
        for (let i = store.history.currentPos - store.history.offset; i > pos; i--) {
            const logStep = store.history.log[i]
            for (let key in logStep.data.before) {
                tempSum[key] = logStep.data.before[key]
            }
        }
        for (let key in tempSum) {
            let xBlock = key % store.imageWidth
            let yBlock = Math.floor(key / store.imageWidth)
            this._fakePaint(xBlock, yBlock, tempSum[key])
            store.imageConvertedHex[key] = tempSum[key]
        }
    }

    this._undoForward = (pos) => {
        pos += -store.history.offset
        const tempSum = {}
        for (let i = store.history.currentPos - store.history.offset; i <= pos; i++) {
            if (i === -1) { continue }
            const logStep = store.history.log[i]
            for (let key in logStep.data.current) {
                tempSum[key] = logStep.data.current[key]
            }
        }
        for (let key in tempSum) {
            let xBlock = key % store.imageWidth
            let yBlock = Math.floor(key / store.imageWidth)
            this._fakePaint(xBlock, yBlock, tempSum[key])
            store.imageConvertedHex[key] = tempSum[key]
        }
    }

    this._undoTo = (pos) => {
        pos = parseInt(pos)
        if (pos === store.history.currentPos) { return }

        if (pos === -1) {
            this._undoBack(store.history.offset)
            store.history.currentPos = pos
            this.render()
            return
        } else if (store.history.currentPos === -1) {
            store.history.currentPos = store.history.offset
            this.render()
        }

        if (store.history.currentPos - pos > 0) {
            this._undoBack(pos)
        } else {
            this._undoForward(pos)
        }

        store.history.currentPos = pos
    }

    this._convertToGroups = () => {
        const catchedBlocks = {}
        const groups = []

        // for (let i = 0; i < store.imageConvertedHex.length; i++) {
        //     let targetPos = i

        //     if (catchedBlocks[targetPos]) { continue }
        //     catchedBlocks[targetPos] = true

        //     let targetBlock = store.imageConvertedHex[targetPos]
        //     let targetWidth = 1
        //     let targetHeight = 1

        //     while (true) {
        //         let tempPos = targetPos + targetWidth
        //         if (store.imageConvertedHex[tempPos] === targetBlock && !catchedBlocks[tempPos]) {
        //             catchedBlocks[targetPos + targetWidth] = true
        //             targetWidth++
        //         } else {
        //             break
        //         }
        //         if ((targetPos + targetWidth) % store.imageWidth === 0) { break }
        //     }

        //     while (true) {
        //         let tempPos = targetPos + targetHeight * store.imageWidth
        //         if (store.imageConvertedHex[tempPos] === targetBlock && !catchedBlocks[tempPos]) {
        //             catchedBlocks[targetPos + targetHeight * store.imageWidth] = true
        //             targetHeight++
        //         } else {
        //             break
        //         }
        //         if (targetPos + targetWidth * store.imageWidth < store.imageWidth) { break }
        //     }

        //     if (targetWidth === 1 && targetHeight === 1) {
        //         groups.push([targetPos])
        //         continue
        //     }

        //     let tempHeight = targetHeight
        //     let startBlockGroup = targetPos
        //     for (let w = 0; w < targetWidth; w++) {
        //         for (let h = 0; h < tempHeight; h++) {
        //             let shiftPos = targetPos + h * store.imageWidth + w + 1
        //             if (store.imageConvertedHex[shiftPos] === targetBlock) {
        //                 catchedBlocks[shiftPos] = true
        //                 if (w + 1 === targetWidth && h + 1 === tempHeight) {
        //                     if (startBlockGroup === targetPos + targetWidth - 1 + (tempHeight - 1) * store.imageWidth) {
        //                         groups.push([startBlockGroup])
        //                     } else {
        //                         groups.push([startBlockGroup, targetPos + targetWidth - 1 + (tempHeight - 1) * store.imageWidth])
        //                     }
        //                 }
        //             } else {
        //                 if (startBlockGroup === targetPos + w + (tempHeight - 1) * store.imageWidth) {
        //                     groups.push([startBlockGroup])
        //                 } else {
        //                     groups.push([startBlockGroup, targetPos + w + (tempHeight - 1) * store.imageWidth])
        //                 }
        //                 startBlockGroup = targetPos + w + 1
        //                 tempHeight = h
        //                 break
        //             }
        //         }
        //     }
        // }

        for (let i = 0; i < store.imageConvertedHex.length; i++) {
            let targetPos = Math.floor((store.imageConvertedHex.length - i - 1) / store.imageWidth) * store.imageWidth + (i % store.imageWidth)

            if (catchedBlocks[targetPos]) { continue }
            catchedBlocks[targetPos] = true

            let targetBlock = store.imageConvertedHex[targetPos]
            if (targetBlock === 0) {
                catchedBlocks[targetPos] = true
                continue
            }

            let targetWidth = 1
            let targetHeight = 1

            while (true) {
                let tempPos = targetPos + targetWidth
                if (store.imageConvertedHex[tempPos] === targetBlock && !catchedBlocks[tempPos]) {
                    catchedBlocks[tempPos] = true
                    targetWidth++
                } else {
                    break
                }
                if ((targetPos + targetWidth) % store.imageWidth === 0) { break }
            }

            while (true) {
                let tempPos = targetPos - targetHeight * store.imageWidth
                if (store.imageConvertedHex[tempPos] === targetBlock && !catchedBlocks[tempPos]) {
                    catchedBlocks[tempPos] = true
                    targetHeight++
                } else {
                    break
                }
                // if (targetPos - targetHeight * store.imageWidth < 0) { break }
            }

            if (targetWidth === 1 && targetHeight === 1) {
                groups.push([targetPos])
                continue
            }

            let tempHeight = targetHeight
            let startBlockGroup = targetPos
            for (let w = 0; w < targetWidth; w++) {
                for (let h = 0; h < tempHeight; h++) {
                    let shiftPos = targetPos - h * store.imageWidth + w + 1
                    if (store.imageConvertedHex[shiftPos] === targetBlock) {
                        catchedBlocks[shiftPos] = true
                        if (w + 1 === targetWidth && h + 1 === tempHeight) {
                            if (startBlockGroup === targetPos + targetWidth - 1 + (tempHeight - 1) * store.imageWidth) {
                                groups.push([startBlockGroup])
                            } else {
                                groups.push([startBlockGroup, targetPos + targetWidth - 1 - (tempHeight - 1) * store.imageWidth])
                            }
                        }
                    } else {
                        if (startBlockGroup === targetPos + w + (tempHeight - 1) * store.imageWidth) {
                            groups.push([startBlockGroup])
                        } else {
                            groups.push([startBlockGroup, targetPos + w - (tempHeight - 1) * store.imageWidth])
                        }
                        startBlockGroup = targetPos + w + 1
                        tempHeight = h
                        break
                    }
                }
            }
        }

        store.groups = groups

        console.log(groups.length, Object.keys(catchedBlocks).length)
        return

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
                              endPos.y * store.baseCellSize * store.scale.current + store.offset.y,
                              (endPos.x - startPos.x + 1) * store.scale.current * store.baseCellSize,
                              (startPos.y - endPos.y + 1) * store.scale.current * store.baseCellSize)
            }
        })
    }

    this._convertPosToRelCoords = (pos, facing, offset) => {
        let output, offsetX = 0, offsetY = 0, offsetZ = 0
        const x = pos.x + 1,
              y = store.imageHeight - pos.y - 1
        if (offset) {
            offsetX = offset.x || 0,
            offsetY = offset.y || 0, 
            offsetZ = offset.z || 0
        }

        switch (facing) {
            case 'east':
                output = `~${x + offsetX} ~${y + offsetY} ~${offsetZ}`
                break
            case 'south':
                output = `~${offsetX} ~${y + offsetY} ~${x + offsetZ}`
                break
            case 'west':
                output = `~${offsetX - x} ~${y + offsetY} ~${offsetZ}`
                break
            case 'north':
                output = `~${offsetX} ~${y + offsetY} ~${offsetZ - x}`
                break
        }
        return output.replace(new RegExp('~0', 'g'), '~')
    }

    this._convertGroupToCommand = (group, facing, offset) => {
        const block = store.getBlockById(store.imageConvertedHex[group[0]])
        let gameId = block.game_id
        if (block.axis) {
            if (store.settings.minecraftVersion < 13) {
                const dataAxis = parseInt(gameId.match(/\d$/)[0])
                if (facing === 'west' || facing === 'east') {
                    gameId = gameId.replace(/\d$/, dataAxis + 8)
                } else if (facing === 'north' || facing === 'south') {
                    gameId = gameId.replace(/\d$/, dataAxis + 4)
                }
            } else {
                console.log('set axis for 13')
            }
        }
        const output = []
        group.forEach((item) => {
            const pos = this._getPosFromInt(item)
            output.push(this._convertPosToRelCoords(pos, facing, offset))
        })
        if (output.length === 1) {
            return `setblock ${output[0]} ${gameId}`
        } else {
            return `fill ${output[0]} ${output[1]} ${gameId}`
        }
    }

    this._setPosOnOpen = () => {
        const canvasWidth = store.canvasWidth + store.interface.rulerSize
        const canvasHeight = store.canvasHeight - store.interface.rulerSize
        for (let i = store.scale.options.length - 1; i >= 0; i--) {
            if (store.imageWidth * store.scale.options[i] * store.baseCellSize < canvasWidth && store.imageHeight * store.scale.options[i] * store.baseCellSize < canvasHeight) {
                store.scale.current = store.scale.options[i]
                break
            }
        }
        store.offset.x = canvasWidth / 2 - store.imageWidth / 2 * store.scale.current * store.baseCellSize
        store.offset.y = canvasHeight / 2 - store.imageHeight / 2 * store.scale.current * store.baseCellSize
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
                const PIPortion = 0.42 / (radius + 1)
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
                
                if (thisRoot.getTool() === 'brush') {
                    let tempMaxRow = maxWidthForRow[Math.abs(Math.floor(i / size) - radius)]
                    if (tempMaxRow < Math.abs(i % size - radius)) { continue }
                }
                thisRoot._fakePaint(xBlock, yBlock, thisRoot.getEyedrop())
                tempFakePaintedPoints[yBlock * store.imageWidth + xBlock] = thisRoot.getEyedrop()
            }
        }

        canvasOverlay.addEventListener('mousemove', function(e) {
            if (!thisRoot._checkIfReady()) { return }
            store.controls.mouse.localX = Math.round(e.clientX - store.boundingRect.x - store.controls.mouse.startX)
            store.controls.mouse.localY = Math.round(e.clientY - store.boundingRect.y - store.controls.mouse.startY)
            let xBlock = (Math.floor((store.controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
            let yBlock = (Math.floor((store.controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))

            if (store.controls.mouse.grabbed) {
                store.offset.translate(store.controls.mouse.localX + store.controls.mouse.oldOffsetX, store.controls.mouse.localY + store.controls.mouse.oldOffsetY)
                thisRoot._renderMainCanvas()
                thisRoot._renderOverlayCanvas()
            }
            if (store.controls.mouse.leftClick && (thisRoot.getTool() === 'pencil' || thisRoot.getTool() === 'brush')) {
                if (xBlock < 0 || xBlock >= store.imageWidth ) { return }
                if (yBlock < 0 || yBlock >= store.imageHeight ) { return }
                // if (store.interface.rulerSize > Math.floor(e.pageX - store.boundingRect.x) ||
                //     store.canvasHeight - store.interface.rulerSize < Math.floor(e.pageY - store.boundingRect.y)) {
                //         return
                // }

                //start the bresenham algorithm with the callback
                const skipEveryN = Math.ceil(store.interface.brushSize / 3) + 1
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
                const tool = thisRoot.getTool()
                let xBlock = (Math.floor((store.controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
                let yBlock = (Math.floor((store.controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))
                store.controls.mouse.lastMouseX = xBlock
                store.controls.mouse.lastMouseY = yBlock
                store.controls.mouse.leftClick = true

                if (tool === 'brush' || tool === 'pencil' || tool === 'bucket') {
                    if (store.history.currentPos === -1) {
                        ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)
                        ctxTemp.drawImage(canvasInit, 0, 0)
                        store.imageConvertedHex.set(store.imageConvertedHexBackup, 0)
                    }
                }

                if (tool === 'eyedropper') {
                    let id = thisRoot._getBlockIdByPosition(xBlock, yBlock)
                    thisRoot.setEyedrop(id)
                }

                if (tool === 'brush' || tool === 'pencil') {
                    draw(xBlock, yBlock)
                }

                if (tool === 'selection') {
                    let tempX = xBlock
                    let tempY = yBlock

                    if (xBlock < 0) { tempX = 0 }
                    if (yBlock < 0) { tempY = 0 }
                    if (xBlock >= store.imageWidth ) { tempX = store.imageWidth - 1 }
                    if (yBlock >= store.imageHeight ) { tempY = store.imageHeight - 1 }
                    store.interface.selection.start = thisRoot._getIntFromPos(tempX, tempY)
                    store.interface.selection.end = thisRoot._getIntFromPos(tempX, tempY)
                }

                if (tool === 'zoom') {
                    if (store.scale.scaleUp()) {
                        let x = Math.floor(store.controls.mouse.localX - store.offset.x)
                        let y = Math.floor(store.controls.mouse.localY - store.offset.y)
                        store.offset.translate(store.offset.x - x, store.offset.y - y)
                        thisRoot.render()
                    }
                }

                if (tool === 'grab') {
                    store.controls.mouse.grabbed = true
                    store.controls.mouse.startX = e.clientX - store.boundingRect.x
                    store.controls.mouse.startY = e.clientY - store.boundingRect.y
                    store.controls.mouse.oldOffsetX = store.offset.x
                    store.controls.mouse.oldOffsetY = store.offset.y
                }

                if (tool === 'bucket') {
                    thisRoot._bucket(xBlock, yBlock, thisRoot.getEyedrop())
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
            if (e.which === 3) {
                if (thisRoot.getTool() === 'zoom') {
                    e.preventDefault()
                    if (store.scale.scaleDown()) {
                        let x = Math.floor(store.controls.mouse.localX - store.offset.x)
                        let y = Math.floor(store.controls.mouse.localY - store.offset.y)
                        store.offset.translate(store.offset.x + x / 2, store.offset.y + y / 2)
                        thisRoot.render()
                    }
                }
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
            if (store.controls.mouse.leftClick) { return }
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

        canvasOverlay.addEventListener('contextmenu', (e) => {
            e.preventDefault()
        })

        window.addEventListener('resize', (e) => {
            thisRoot.setBoundingRect()
        })

        window.addEventListener('scroll', (e) => {
            thisRoot.setBoundingRect()
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
                    drawRulerEveryNBlocks = 10
                    break
                case 0.25:
                    drawRulerEveryNBlocks = 50
                    break
                case 0.125:
                    drawRulerEveryNBlocks = 50
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
            
            if (thisRoot.getTool() === 'pencil') {
                let xBlock = (Math.floor((store.controls.mouse.localX - store.offset.x) / (store.baseCellSize * store.scale.current)))
                let yBlock = (Math.floor((store.controls.mouse.localY - store.offset.y) / (store.baseCellSize * store.scale.current)))
                ctxOverlay.rect((xBlock - Math.floor(store.interface.brushSize / 2)) * store.baseCellSize * store.scale.current + store.offset.x,
                                (yBlock - Math.floor(store.interface.brushSize / 2)) * store.baseCellSize * store.scale.current + store.offset.y,
                                brushSize,
                                brushSize)
            }

            if (thisRoot.getTool() === 'brush') {
                ctxOverlay.arc(store.controls.mouse.localX,
                        store.controls.mouse.localY,
                        brushSize / 2,
                        0,2*Math.PI);
            }

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

            ctxOverlay.beginPath();
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
            ctxOverlay.save()
            ctxOverlay.clearRect(0, 0, store.canvasWidth, store.canvasHeight)
            list.forEach((item) => {
                if (renderList[item]) {
                    renderList[item]()
                    ctxOverlay.restore()
                }
            })
        }

        const renderArray = ['RENDER_SELECTION']

        if ((this.getTool() === 'pencil' || this.getTool() === 'brush') && !store.controls.mouse.grabbed) {
            renderArray.push('RENDER_BRUSH')
        }

        if (store.settings.showRulers) {
            renderArray.push('RENDER_RULERS')
        }

        renderHelper(renderArray)
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
                    mainGridLineEveryN = 10
                    break
                case 0.5:
                    mainGridLineEveryN = 10
                    break
                case 0.25:
                    mainGridLineEveryN = 50
                    break
                case 0.125:
                    mainGridLineEveryN = 50
                    break
                case 0.0625:
                    mainGridLineEveryN = 100
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

            for (let i = startOfRenderGridHorizontal + 1; i <= endOfRenderGridHorizontal; i += 1) {
                ctxMain.beginPath()
                ctxMain.globalAlpha = 1
                if (i % mainGridLineEveryN === 0) {
                    ctxMain.lineWidth = lineWidthBig
                    ctxMain.moveTo(topOfGridHorizontal, (store.imageHeight - i) * store.scale.current * 16 + store.offset.y)
                    ctxMain.lineTo(bottomOfGridHorizontal, (store.imageHeight - i) * store.scale.current * 16 + store.offset.y)
                } else if (lineWidthSmall > 0) {
                    ctxMain.globalAlpha = store.scale.current / 4 * 2
                    ctxMain.lineWidth = lineWidthSmall
                    ctxMain.moveTo(topOfGridHorizontal, (store.imageHeight - i) * store.scale.current * 16 + store.offset.y + 0.5)
                    ctxMain.lineTo(bottomOfGridHorizontal, (store.imageHeight - i) * store.scale.current * 16 + store.offset.y + 0.5)
                }
                ctxMain.stroke()
            }

            for (let i = startOfRenderGridVertical + 1; i <= endOfRenderGridVertical; i += 1) {
                ctxMain.beginPath()
                ctxMain.globalAlpha = 1
                if (i % mainGridLineEveryN === 0) {
                    ctxMain.lineWidth = lineWidthBig
                    ctxMain.moveTo(i * store.scale.current * 16 + store.offset.x, topOfGridVertical)
                    ctxMain.lineTo(i * store.scale.current * 16 + store.offset.x, bottomOfGridVertical)
                } else if (lineWidthSmall > 0) {
                    ctxMain.globalAlpha = store.scale.current / 4 * 2
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
                let hexBlock, source
                if (store.history.currentPos === -1) {
                    source = store.imageConvertedHexBackup
                } else {
                    source = store.imageConvertedHex
                }

                for (let y = topLeftY; y <= bottomRightY; y++) {
                    for (let x = topLeftX; x <= bottomRightX; x++) {
                        if (x < store.imageWidth && y < store.imageHeight) {
                            hexBlock = source[y * store.imageWidth + x]
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
                let source
                if (store.history.currentPos === -1) {
                    source = canvasInit
                } else {
                    source = canvasTemp
                }
                ctxMain.drawImage(source,
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

        function renderOriginal() {
            ctxMain.drawImage(store.originalImage,
                  store.offset.x, 
                  store.offset.y, 
                  store.imageWidth * store.baseCellSize * store.scale.current, 
                  store.imageHeight * store.baseCellSize * store.scale.current)
        }

        function renderBackground() {
            ctxMain.fillStyle = 'rgba(100, 100, 100, 0.45)'
            ctxMain.fillRect(0, 0, store.canvasWidth, store.canvasHeight)
            ctxMain.clearRect(store.offset.x, 
                              store.offset.y, 
                              store.imageWidth * store.baseCellSize * store.scale.current, 
                              store.imageHeight * store.baseCellSize * store.scale.current)
        }

        function renderGroups() {
            if (store.debug.drawGroups[0] === undefined) { return }
            const groups = store.debug.drawGroups[store.settings.drawGroupsCurrent]
            groups.forEach((item) => {
                if (item.length === 1) {
                    const pos = thisRoot._getPosFromInt(item[0])
                    ctxMain.fillStyle = "red"
                    ctxMain.fillRect(
                                  pos.x * store.baseCellSize * store.scale.current + store.offset.x,
                                  pos.y * store.baseCellSize * store.scale.current + store.offset.y,
                                  store.scale.current * store.baseCellSize,
                                  store.scale.current * store.baseCellSize)
                } else {
                    const startPos = thisRoot._getPosFromInt(item[0])
                    const endPos = thisRoot._getPosFromInt(item[1])
                    ctxMain.strokeRect(
                                  startPos.x * store.baseCellSize * store.scale.current + store.offset.x,
                                  endPos.y * store.baseCellSize * store.scale.current + store.offset.y,
                                  (endPos.x - startPos.x + 1) * store.scale.current * store.baseCellSize,
                                  (startPos.y - endPos.y + 1) * store.scale.current * store.baseCellSize)
                }
            })
        }
        
        const renderList = {
            'RENDER_MAIN': renderMain,
            'RENDER_GRID': renderGrid,
            'RENDER_ORIGINAL': renderOriginal,
            'RENDER_BACKGROUND': renderBackground,
            'RENDER_GROUPS': renderGroups
        }

        function renderHelper(list) {
            ctxMain.clearRect(0, 0, store.canvasWidth, store.canvasHeight)
            ctxMain.globalAlpha = 1
            ctxMain.save()
            for (let key in list) {
                if (renderList[list[key]]) { renderList[list[key]]() }
                ctxMain.restore()
            }
        }

        var t0 = performance.now()
        ctxMain.clearRect(0, 0, store.canvasWidth, store.canvasHeight)

        renderHelper([
            'RENDER_BACKGROUND',
            store.settings.showOriginal ? 'RENDER_ORIGINAL' : 'RENDER_MAIN',
            store.settings.showGrid ? 'RENDER_GRID' : false,
            store.settings.showDebugDrawGroups ? 'RENDER_GROUPS' : false,
        ])
        // console.log(performance.now() - t0)
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
            info: store.getBlockById(this._getBlockIdByPosition(xBlock, yBlock)),
            blockPos: xBlock + yBlock * store.imageWidth
        } 
    }

    this.setImageSizes = (w, h) => {
        store.imageWidth = parseInt(w)
        store.imageHeight = parseInt(h)
        canvasTemp.width = store.imageWidth * 16
        canvasTemp.height = store.imageHeight * 16
        ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)
        canvasInit.width = store.imageWidth * 16
        canvasInit.height = store.imageHeight * 16
        ctxInit.clearRect(0, 0, canvasInit.width, canvasInit.height)
        console.log('cleared')
    }

    this.setBoundingRect = () => {
        store.boundingRect = $root.getBoundingClientRect()
        store.canvasWidth = store.boundingRect.width
        store.canvasHeight = store.boundingRect.height
        canvasMain.width = store.canvasWidth
        canvasMain.height = store.canvasHeight
        canvasOverlay.width = store.canvasWidth
        canvasOverlay.height = store.canvasHeight
        ctxMain.imageSmoothingEnabled = false
        this.render()
    }

    this.setBounds = () => {
        store.offset.bounds.x = store.canvasWidth - store.imageWidth / 1.75
        store.offset.bounds.y = store.canvasHeight - store.imageHeight / 1.75
    }

    this.setTool = (str) => {
        store.interface.toolCurrent = str
    }

    this.getTool = () => {
        return store.interface.toolCurrent
    }

    this.loadImageHex = (arr) => {
        store.imageConvertedHex = arr
        store.imageConvertedHexBackup = new Uint8Array(arr.length)
        store.imageConvertedHexBackup.set(arr, 0)
        this._createMainBlobImage(arr)
    }

    this.setEyedrop = (id) => {
        store.interface.eyedropCurrent = id
    }

    this.getEyedrop = () => {
        return store.interface.eyedropCurrent
    }

    this.setBrushSize = (int) => {
        if (int < 1) {
            store.interface.brushSize = 1 
        } else if(int > store.settings.maxBrushSize) {
            store.interface.brushSize = store.settings.maxBrushSize
        } else {
            store.interface.brushSize = int
        }
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

    this.setSettingsValue = (key, value) => {
        store.settings[key] = value
    }

    this.reset = () => {
        store.imageConvertedHex = null
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
        this.reset()
        this._setPosOnOpen()
        this.loadImageHex(uint8Arr)
        this.render()
    }

    this.save = () => {
        //version 1 save: 
        //8-byte version, 8-byte blockstype, 16-byte width, 16-byte height, rest 8-byte ids
        const version = 1,
              blocksType = 1

        const buffer = new ArrayBuffer(store.imageConvertedHex.length + 6)
        const data = new DataView(buffer)

        data.setUint8(0, version)
        data.setUint8(1, blocksType)
        data.setUint16(2, store.imageWidth)
        data.setUint16(4, store.imageHeight)

        store.imageConvertedHex.forEach((item, i) => {
            data.setUint8(i + 6, item)
        })

        const blob = new Blob([data], {type : 'text/plain'})
        return _URL.createObjectURL(blob)
    }

    this.resetGroups = () => {
        store.groups = null
    }

    this.setOriginalImageSrc = (str) => {
        store.originalImage.src = str
    }

    this.convertAsRaw = (facing) => {
        if (store.groups === null) {
            this._convertToGroups()
        }

        let output = []
        store.groups.forEach((item) => {
            output.push('/' + this._convertGroupToCommand(item, facing))
        })

        return output
    }

    this.convertAsMcfunction = (facing) => {
        if (store.groups === null) {
            this._convertToGroups()
        }

        let output = ""
        store.groups.forEach((item) => {
            output += this._convertGroupToCommand(item, facing) + "\n"
        })

        return output
    }

    this.convertAsCommandBlock = (facing) => {
        if (store.groups === null) {
            this._convertToGroups()
        }

        store.debug.drawGroups = []

        const maxLength = 31449 - 150
        const outputArr = []
        let debugDrawGroup = []
        let commandTemplate, outsideTemplate, passengerTemplate, commandBlockCartId, fallingBlockId
        let tempStr

        switch (store.settings.minecraftVersion) {
            case 9:
            case 10:
                fallingBlockId = 'FallingSand'
                commandBlockCartId = 'MinecartCommandBlock'
                break
            case 11:
            case 12:
                fallingBlockId = 'falling_block'
                commandBlockCartId = 'commandblock_minecart'
                break
        }

        commandTemplate = `summon ${fallingBlockId} ~ ~1 ~ {Time:1,Passengers:[%passenger%]}`

        passengerTemplate = `
        {
            id: "${commandBlockCartId}",
            Command: "%command%",
            Passengers: [%passenger%]
        }
        `
        tempStr = passengerTemplate.replace(/\n|\s/g, '')

        for (let i = 0; i <= store.groups.length; i++) {
            if (i === store.groups.length) {
                tempStr = tempStr.replace('%command%', `kill @e[type=${commandBlockCartId},r=2]`)
                                 .replace(',Passengers:[%passenger%]', '')
                outputArr.push(commandTemplate.replace('%passenger%', tempStr))
                store.debug.drawGroups.push(debugDrawGroup)
                debugDrawGroup = []
                continue
            }

            tempStr = tempStr.replace('%command%', this._convertGroupToCommand(store.groups[i], facing, {y: -1}))
                             .replace('%passenger%', passengerTemplate.replace(/\n|\s/g, ''))
            debugDrawGroup.push(store.groups[i])

            if (tempStr.length > maxLength) {
                tempStr = tempStr.replace('%command%', `kill @e[type=${commandBlockCartId},r=2]`)
                                 .replace(',Passengers:[%passenger%]', '')
                outputArr.push(commandTemplate.replace('%passenger%', tempStr))
                tempStr = passengerTemplate.replace(/\n|\s/g, '')
                store.debug.drawGroups.push(debugDrawGroup)
                debugDrawGroup = []
            }
        }
        return outputArr
    }

    this.getQuantityOfBlocks = () => {
        const output = []
        const temp = {}
        store.imageConvertedHex.forEach((item) => {
            if (item > 0) {
                if (temp[item]) {
                    temp[item]++
                } else {
                    temp[item] = 1
                }
            }
        })

        for (let key in temp) {
            output.push({
                id: key,
                quant: temp[key]
            })
        }

        output.sort((a,b) => {
            return b.quant - a.quant
        })

        return output
    }

    this.render = () => {
        this._renderMainCanvas()
        this._renderOverlayCanvas()
    }

    this.init = function(rootNode) {
        if (store.initFlag) {
            this.reset()
            return
        }
        store.initFlag = true
        $root = rootNode
        $root.style.position = 'relative'
        canvasMain.style.position = 'absolute'
        canvasOverlay.style.position = 'absolute'
        this.setBoundingRect()
        this.setBounds()
        $root.appendChild(canvasMain)
        $root.appendChild(canvasOverlay)

        ctxMain.imageSmoothingEnabled = false
        this._setEventListeners()
    }
}

export default MineartCanvas
