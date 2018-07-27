import { setAttr } from 'redom'

function SvgCroppy() {
    const store = {
        style: {
            cornerWidth: 20,
            cornerHeight: 20
        },
        posData: {
            boundingRect: null,
            selectRect: {
                width: 50,
                height: 50,
                offsetX: 0,
                offsetY: 0,
                minWidth: 10,
                minHeight: 10
            }
        },
        nodes: {
            root: null,
            wrapper: null,
            svg: null
        },
        svgNodes: {
            backgroundRect: null,
            selectRect: null,
            selectRectMask: null,
            cornerLeftTop: null,
            cornerRightTop: null,
            cornerLeftBottom: null,
            cornerRightBottom: null,
            barTop: null,
            barLeft: null,
            barRight: null,
            barBottom: null
        },
        events: {
            transformed: new Event('croppytransformed')
        }
    }

    this._storeSetNode = (key, node) => {
        if (store.nodes[key] === undefined) {
            throw new Error('[SvgCroppy] Unknown key in store.nodes')
        }
        store.nodes[key] = node
        return node
    }

    this._storeGetNode = (key) => {
        return store.nodes[key]
    }

    this._storeSetSvgNode = (key, node) => {
        if (store.svgNodes[key] === undefined) {
            throw new Error('[SvgCroppy] Unknown key in store.svgNodes')
        }
        store.svgNodes[key] = node
        return node
    }

    this._storeGetSvgNode = (key) => {
        return store.svgNodes[key]
    }

    this._setPosDataSelectRect = (key, value) => {
        switch (key) {
            case 'width':
                if (value <= store.posData.selectRect.minWidth) {
                    store.posData.selectRect.width = store.posData.selectRect.minWidth
                } else if (value >= store.posData.boundingRect.width - store.posData.selectRect.offsetX) {
                    store.posData.selectRect.width = store.posData.boundingRect.width - store.posData.selectRect.offsetX
                } else {
                    store.posData.selectRect.width = value
                }
                break
            case 'height':
                if (value <= store.posData.selectRect.minHeight) {
                    store.posData.selectRect.height = store.posData.selectRect.minHeight
                } else if (value >= store.posData.boundingRect.height - store.posData.selectRect.offsetY) {
                    store.posData.selectRect.height = store.posData.boundingRect.height - store.posData.selectRect.offsetY
                } else {
                    store.posData.selectRect.height = value
                }
                break
            case 'offsetX':
                if (value <= 0) {
                    store.posData.selectRect.offsetX = 0
                } else if (value >= store.posData.boundingRect.width - store.posData.selectRect.width) {
                    store.posData.selectRect.offsetX = store.posData.boundingRect.width - store.posData.selectRect.width
                } else {
                    store.posData.selectRect.offsetX = value
                }
                break
            case 'offsetY':
                if (value <= 0) {
                    store.posData.selectRect.offsetY = 0
                } else if (value >= store.posData.boundingRect.height - store.posData.selectRect.height) {
                    store.posData.selectRect.offsetY = store.posData.boundingRect.height - store.posData.selectRect.height
                } else {
                    store.posData.selectRect.offsetY = value
                }
                break
        }
    }

    this._setEventListeners = () => {
        const $root = this._storeGetNode('root'),
              $svg = this._storeGetNode('svg'),
              $selectRect = this._storeGetSvgNode('selectRect'),
              $cornerLeftTop = this._storeGetSvgNode('cornerLeftTop'),
              $cornerRightTop = this._storeGetSvgNode('cornerRightTop'),
              $cornerLeftBottom = this._storeGetSvgNode('cornerLeftBottom'),
              $cornerRightBottom = this._storeGetSvgNode('cornerRightBottom'),
              $barTop = this._storeGetSvgNode('barTop'),
              $barLeft = this._storeGetSvgNode('barLeft'),
              $barRight = this._storeGetSvgNode('barRight'),
              $barBottom = this._storeGetSvgNode('barBottom')


        const svgNodeStyleAliases = {
            'croppy-svg-corner-left-top' : 'CORNER_LEFT_TOP',
            'croppy-svg-corner-right-top' : 'CORNER_RIGHT_TOP',
            'croppy-svg-corner-left-bottom' : 'CORNER_LEFT_BOTTOM',
            'croppy-svg-corner-right-bottom' : 'CORNER_RIGHT_BOTTOM',
            'croppy-svg-bar-top' : 'BAR_TOP',
            'croppy-svg-bar-left' : 'BAR_LEFT',
            'croppy-svg-bar-right' : 'BAR_RIGHT',
            'croppy-svg-bar-bottom' : 'BAR_BOTTOM',
            'croppy-svg-select' : 'SELECT_RECT'
        }

        const grabbed = {
            el: null,
            startX: null,
            startY: null,
            oldWidth: null,
            oldHeight: null
        }
        const svgControls = [$cornerLeftTop, $cornerRightTop, $cornerLeftBottom, $cornerRightBottom,
                             $barTop, $barLeft, $barRight, $barBottom, 
                             $selectRect]

        for (let key in svgControls) {
            svgControls[key].addEventListener('mousedown', (e) => {
                const localXY = {
                    x: e.pageX - store.posData.boundingRect.x,
                    y: e.pageY - store.posData.boundingRect.y
                }

                grabbed.el = svgNodeStyleAliases[e.target.classList[1]] || svgNodeStyleAliases[e.target.classList[0]]
                if (grabbed.el === undefined) { throw new Error('[SvgCroppy] Selected node is not defined in aliases') }
                grabbed.startX = localXY.x
                grabbed.startY = localXY.y
                grabbed.oldWidth = store.posData.selectRect.width
                grabbed.oldHeight = store.posData.selectRect.height
                grabbed.oldOffsetX = store.posData.selectRect.offsetX
                grabbed.oldOffsetY = store.posData.selectRect.offsetY
                grabbed.oldEndX = store.posData.selectRect.offsetX + store.posData.selectRect.width
                grabbed.oldEndY = store.posData.selectRect.offsetY + store.posData.selectRect.height
            })
        }

        document.addEventListener('mousemove', (e) => {
            if (e.target.constructor.name !== 'HTMLHtmlElement') {
                if (e.target.parentNode.getAttribute('class') !== 'croppy-svg' && !grabbed.el) { //hardcode
                    return
                }
            }

            if (grabbed.el) {
                const startLocal = {
                    x: e.pageX - store.posData.boundingRect.x - grabbed.startX,
                    y: e.pageY - store.posData.boundingRect.y - grabbed.startY,
                }
                switch (grabbed.el) {
                    case 'CORNER_LEFT_TOP':
                        if (grabbed.oldOffsetX + startLocal.x > 0 && grabbed.oldEndX >= grabbed.oldOffsetX + startLocal.x + store.posData.selectRect.minWidth) {
                            this._setPosDataSelectRect('offsetX', grabbed.oldOffsetX + startLocal.x) 
                            this._setPosDataSelectRect('width', grabbed.oldWidth - startLocal.x)
                        } else if (grabbed.oldOffsetX + startLocal.x <= 0) {
                            this._setPosDataSelectRect('offsetX', 0)
                            this._setPosDataSelectRect('width', grabbed.oldEndX)
                        } else {
                            this._setPosDataSelectRect('offsetX', grabbed.oldEndX - store.posData.selectRect.minWidth)
                            this._setPosDataSelectRect('width', store.posData.selectRect.minWidth)
                        }
                        if (grabbed.oldOffsetY + startLocal.y <= 0) {
                            this._setPosDataSelectRect('offsetY', 0)
                            this._setPosDataSelectRect('height', grabbed.oldEndY)
                        } else if (grabbed.oldEndY >= grabbed.oldOffsetY + startLocal.y + store.posData.selectRect.minHeight) {
                            this._setPosDataSelectRect('offsetY', grabbed.oldOffsetY + startLocal.y) 
                            this._setPosDataSelectRect('height', grabbed.oldHeight - startLocal.y)
                        } else {
                            this._setPosDataSelectRect('offsetY', grabbed.oldEndY - store.posData.selectRect.minHeight)
                            this._setPosDataSelectRect('height', store.posData.selectRect.minHeight)
                        }
                        break
                    case 'CORNER_RIGHT_TOP':
                        if (grabbed.oldOffsetY + startLocal.y <= 0) {
                            this._setPosDataSelectRect('offsetY', 0)
                            this._setPosDataSelectRect('height', grabbed.oldEndY)
                        } else if (grabbed.oldEndY >= grabbed.oldOffsetY + startLocal.y + store.posData.selectRect.minHeight) {
                            this._setPosDataSelectRect('offsetY', grabbed.oldOffsetY + startLocal.y)
                            this._setPosDataSelectRect('height', grabbed.oldHeight - startLocal.y)
                        }  else {
                            this._setPosDataSelectRect('offsetY', grabbed.oldEndY - store.posData.selectRect.minHeight)
                            this._setPosDataSelectRect('height', store.posData.selectRect.minHeight)
                        }
                        
                        this._setPosDataSelectRect('width', grabbed.oldWidth + startLocal.x)
                        break
                    case 'CORNER_LEFT_BOTTOM':
                        if (grabbed.oldOffsetX + startLocal.x > 0 && grabbed.oldEndX >= grabbed.oldOffsetX + startLocal.x + store.posData.selectRect.minWidth) {
                            this._setPosDataSelectRect('offsetX', grabbed.oldOffsetX + startLocal.x) 
                            this._setPosDataSelectRect('width', grabbed.oldWidth - startLocal.x)
                        } else if (grabbed.oldOffsetX + startLocal.x <= 0) {
                            this._setPosDataSelectRect('offsetX', 0)
                            this._setPosDataSelectRect('width', grabbed.oldEndX)
                        } else {
                            this._setPosDataSelectRect('offsetX', grabbed.oldEndX - store.posData.selectRect.minWidth)
                            this._setPosDataSelectRect('width', store.posData.selectRect.minWidth)
                        }
                        this._setPosDataSelectRect('height', grabbed.oldHeight + startLocal.y)
                        break
                    case 'CORNER_RIGHT_BOTTOM':
                        this._setPosDataSelectRect('width', grabbed.oldWidth + startLocal.x)
                        this._setPosDataSelectRect('height', grabbed.oldHeight + startLocal.y)
                        break
                    case 'BAR_TOP':
                        if (grabbed.oldOffsetY + startLocal.y <= 0) {
                            this._setPosDataSelectRect('offsetY', 0)
                            this._setPosDataSelectRect('height', grabbed.oldEndY)
                        } else if (grabbed.oldEndY >= grabbed.oldOffsetY + startLocal.y + store.posData.selectRect.minHeight) {
                            this._setPosDataSelectRect('offsetY', grabbed.oldOffsetY + startLocal.y) 
                            this._setPosDataSelectRect('height', grabbed.oldHeight - startLocal.y)
                        } else {
                            this._setPosDataSelectRect('offsetY', grabbed.oldEndY - store.posData.selectRect.minHeight)
                            this._setPosDataSelectRect('height', store.posData.selectRect.minHeight)
                        }
                        break
                    case 'BAR_LEFT':
                        if (grabbed.oldOffsetX + startLocal.x > 0 && grabbed.oldEndX >= grabbed.oldOffsetX + startLocal.x + store.posData.selectRect.minWidth) {
                            this._setPosDataSelectRect('offsetX', grabbed.oldOffsetX + startLocal.x) 
                            this._setPosDataSelectRect('width', grabbed.oldWidth - startLocal.x)
                        } else if (grabbed.oldOffsetX + startLocal.x <= 0) {
                            this._setPosDataSelectRect('offsetX', 0)
                            this._setPosDataSelectRect('width', grabbed.oldEndX)
                        } else {
                            this._setPosDataSelectRect('offsetX', grabbed.oldEndX - store.posData.selectRect.minWidth)
                            this._setPosDataSelectRect('width', store.posData.selectRect.minWidth)
                        }
                        break
                    case 'BAR_RIGHT':
                        this._setPosDataSelectRect('width', grabbed.oldWidth + startLocal.x)
                        break
                    case 'BAR_BOTTOM':
                        this._setPosDataSelectRect('height', grabbed.oldHeight + startLocal.y)
                        break
                    case 'SELECT_RECT':
                        this._setPosDataSelectRect('offsetX', grabbed.oldOffsetX + startLocal.x)
                        this._setPosDataSelectRect('offsetY', grabbed.oldOffsetY + startLocal.y)
                        break
                }
                this.render()
                $root.dispatchEvent(store.events.transformed)
            }

        })

        document.addEventListener('mouseup', (e) => {
            grabbed.el = null
            grabbed.startX = null
            grabbed.startY = null
            grabbed.oldWidth = null
            grabbed.oldHeight = null
            grabbed.oldOffsetX = null
            grabbed.oldOffsetY = null
            grabbed.oldEndX = null
            grabbed.oldEndY = null
        })
    }

    this.render = () => {
        const $selectRect = this._storeGetSvgNode('selectRect'),
              $selectRectMask = this._storeGetSvgNode('selectRectMask'),
              $cornerLeftTop = this._storeGetSvgNode('cornerLeftTop'),
              $cornerRightTop = this._storeGetSvgNode('cornerRightTop'),
              $cornerLeftBottom = this._storeGetSvgNode('cornerLeftBottom'),
              $cornerRightBottom = this._storeGetSvgNode('cornerRightBottom'),
              $barTop = this._storeGetSvgNode('barTop'),
              $barLeft = this._storeGetSvgNode('barLeft'),
              $barRight = this._storeGetSvgNode('barRight'),
              $barBottom = this._storeGetSvgNode('barBottom')
              

        setAttr($selectRectMask, {
            x: store.posData.selectRect.offsetX,
            y: store.posData.selectRect.offsetY,
            width: store.posData.selectRect.width,
            height: store.posData.selectRect.height
        })

        setAttr($selectRect, {
            x: store.posData.selectRect.offsetX,
            y: store.posData.selectRect.offsetY,
            width: store.posData.selectRect.width,
            height: store.posData.selectRect.height
        })

        setAttr($cornerLeftTop, {
            x: store.posData.selectRect.offsetX - Math.round(store.style.cornerWidth / 2),
            y: store.posData.selectRect.offsetY - Math.round(store.style.cornerHeight / 2)
        })

        setAttr($cornerRightTop, {
            x: store.posData.selectRect.offsetX + store.posData.selectRect.width - Math.round(store.style.cornerWidth / 2),
            y: store.posData.selectRect.offsetY - Math.round(store.style.cornerHeight / 2)
        })

        setAttr($cornerLeftBottom, {
            x: store.posData.selectRect.offsetX - Math.round(store.style.cornerWidth / 2),
            y: store.posData.selectRect.offsetY + store.posData.selectRect.height - Math.round(store.style.cornerHeight / 2)
        })

        setAttr($cornerRightBottom, {
            x: store.posData.selectRect.offsetX + store.posData.selectRect.width - Math.round(store.style.cornerWidth / 2),
            y: store.posData.selectRect.offsetY + store.posData.selectRect.height - Math.round(store.style.cornerHeight / 2)
        })

        setAttr($barTop, {
            x: store.posData.selectRect.offsetX - Math.round(store.style.cornerWidth / 2) + store.style.cornerWidth,
            y: store.posData.selectRect.offsetY - Math.round(store.style.cornerHeight / 2),
            width: store.posData.selectRect.width - store.style.cornerHeight >= 0 ? store.posData.selectRect.width - store.style.cornerHeight : 0,
            height: store.style.cornerHeight
        })

        setAttr($barLeft, {
            x: store.posData.selectRect.offsetX - Math.round(store.style.cornerWidth / 2),
            y: store.posData.selectRect.offsetY - Math.round(store.style.cornerHeight / 2) + store.style.cornerHeight,
            width: store.style.cornerWidth,
            height: store.posData.selectRect.height - store.style.cornerHeight >= 0 ? store.posData.selectRect.height - store.style.cornerHeight : 0
        })

        setAttr($barRight, {
            x: store.posData.selectRect.offsetX - Math.round(store.style.cornerWidth / 2) + store.posData.selectRect.width,
            y: store.posData.selectRect.offsetY - Math.round(store.style.cornerHeight / 2) + store.style.cornerHeight,
            width: store.style.cornerWidth,
            height: store.posData.selectRect.height - store.style.cornerHeight >= 0 ? store.posData.selectRect.height - store.style.cornerHeight : 0
        })

        setAttr($barBottom, {
            x: store.posData.selectRect.offsetX - Math.round(store.style.cornerWidth / 2) + store.style.cornerWidth,
            y: store.posData.selectRect.offsetY - Math.round(store.style.cornerHeight / 2) + store.posData.selectRect.height,
            width: store.posData.selectRect.width - store.style.cornerHeight >= 0 ? store.posData.selectRect.width - store.style.cornerHeight : 0,
            height: store.style.cornerHeight
        })
    }

    this.getCropInfo = () => {
        return {
            offsetX: store.posData.selectRect.offsetX,
            offsetY: store.posData.selectRect.offsetY,
            width: store.posData.selectRect.width,
            height: store.posData.selectRect.height,
            boundWidth: store.posData.boundingRect.width,
            boundHeight: store.posData.boundingRect.height,
        }
    }

    this.hide = () => {
        if (store.nodes.svg) {
            store.nodes.svg.classList.add('croppy-hidden')
        }
    }

    this.unhide = () => {
        if (store.nodes.svg) {
            store.nodes.svg.classList.remove('croppy-hidden')
        }
        this._storeGetNode('root').dispatchEvent(store.events.transformed)
    }

    this.init = (rootSelector) => {
        const svgTemplate = `
            <style>
                .croppy-hidden {
                    display: none;
                }

                .croppy-wrapper {
                    display: inline-block;
                    position: relative;
                    margin: 0;
                    padding: 0;
                }

                .croppy-svg {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                }

                .croppy-svg-select {
                    fill-opacity: 0;
                    stroke: white;
                    stroke-dasharray: 5 5;
                    stroke-width: 2px;
                    cursor: move;
                }

                .croppy-svg-background {
                    opacity: 0.75;
                    height: 100%;
                    width: 100%;
                }

                .croppy-svg-corner {
                    opacity: 0;
                }

                .croppy-svg-corner-left-top, .croppy-svg-corner-right-bottom {
                    cursor: nwse-resize;
                }

                .croppy-svg-corner-left-bottom, .croppy-svg-corner-right-top {
                    cursor: nesw-resize;
                }

                .croppy-svg-bar {
                    opacity: 0;
                }

                .croppy-svg-bar-top, .croppy-svg-bar-bottom {
                    cursor: ns-resize;
                }

                .croppy-svg-bar-left, .croppy-svg-bar-right {
                    cursor: ew-resize;
                }
            </style>
            <svg class="croppy-svg">
                <defs>
                    <mask id="mymask" x="0" y="0" width="100%" height="100%">
                        <rect fill="white" width="100%" height="100%"/>
                        <rect class="croppy-svg-mask" fill="black"/>
                    <mask/>
                </defs>
                <rect class="croppy-svg-background" width="100%" height="100%" style="mask: url('#mymask');"/>
                <rect class="croppy-svg-select"/>

                <rect class="croppy-svg-corner croppy-svg-corner-left-top" width="${store.style.cornerWidth}px" height="${store.style.cornerHeight}px"/>
                <rect class="croppy-svg-corner croppy-svg-corner-right-top" width="${store.style.cornerWidth}px" height="${store.style.cornerHeight}px"/>
                <rect class="croppy-svg-corner croppy-svg-corner-left-bottom" width="${store.style.cornerWidth}px" height="${store.style.cornerHeight}px"/>
                <rect class="croppy-svg-corner croppy-svg-corner-right-bottom" width="${store.style.cornerWidth}px" height="${store.style.cornerHeight}px"/>

                <rect class="croppy-svg-bar croppy-svg-bar-top"/>
                <rect class="croppy-svg-bar croppy-svg-bar-left"/>
                <rect class="croppy-svg-bar croppy-svg-bar-right"/>
                <rect class="croppy-svg-bar croppy-svg-bar-bottom"/>

            </svg>
        `
        let $root = null

        if (rootSelector.constructor.name === 'String') {
            $root = document.querySelector(rootSelector)
        } else {
            $root = rootSelector
        }

        if ($root === null) { throw new Error('[SvgCroppy] rootNode is null') }

        const $wrapper = document.createElement('div')
        $wrapper.className = 'croppy-wrapper'
        $wrapper.style.width = $root.width + 'px'
        $wrapper.style.height = $root.height + 'px'

        store.posData.selectRect.width = $root.width - 40
        store.posData.selectRect.height = $root.height - 40
        store.posData.selectRect.offsetX = 20
        store.posData.selectRect.offsetY = 20

        this._storeSetNode('wrapper', $wrapper)
        this._storeSetNode('root', $root)

        $root.parentNode.insertBefore($wrapper, $root)
        $wrapper.innerHTML = svgTemplate
        $wrapper.append($root)

        const $svg = this._storeSetNode('svg', $wrapper.querySelector('svg')) 
        const $svgBackgroundRect = this._storeSetSvgNode('backgroundRect', $svg.querySelector('.croppy-svg-background'))
        const $svgSelectRect = this._storeSetSvgNode('selectRect', $svg.querySelector('.croppy-svg-select'))

        this._storeSetSvgNode('selectRectMask', $svg.querySelector('.croppy-svg-mask'))

        this._storeSetSvgNode('cornerLeftTop', $svg.querySelector('.croppy-svg-corner-left-top'))
        this._storeSetSvgNode('cornerRightTop', $svg.querySelector('.croppy-svg-corner-right-top'))
        this._storeSetSvgNode('cornerLeftBottom', $svg.querySelector('.croppy-svg-corner-left-bottom'))
        this._storeSetSvgNode('cornerRightBottom', $svg.querySelector('.croppy-svg-corner-right-bottom'))

        this._storeSetSvgNode('barTop', $svg.querySelector('.croppy-svg-bar-top'))
        this._storeSetSvgNode('barLeft', $svg.querySelector('.croppy-svg-bar-left')),
        this._storeSetSvgNode('barRight', $svg.querySelector('.croppy-svg-bar-right')),
        this._storeSetSvgNode('barBottom', $svg.querySelector('.croppy-svg-bar-bottom')),

        setAttr($svgSelectRect, {
            width: store.posData.selectRect.width,
            height: store.posData.selectRect.height,
            x: store.posData.selectRect.offsetX,
            y: store.posData.selectRect.offsetY
        })

        this.render()
        store.posData.boundingRect = $svg.getBoundingClientRect()
        this._setEventListeners()
    }
}

export default SvgCroppy
