import './style.css'

import ConvertWorker from 'worker-loader!./convert.js'
import MineartCanvas from './canvas.js'

const _URL = window.URL || window.webkitURL

const convertWorker = new ConvertWorker()
const mineartCanvas = new MineartCanvas('canvasMain')

const $canvasMain = document.getElementById('canvasMain')
const $dropzone = document.getElementById('dropzone')
const $paintTable = document.getElementById('paint-table')
const $settings = document.getElementById('settings')

const $settingsImage = document.getElementById('settings-img')
const $settingsForm = document.getElementById('settings-form')

const canvasTemp = document.createElement('canvas')
const ctxTemp = canvasTemp.getContext('2d')

function SvgCroppy(imgSelector) {
    this.store = {
        posData: {
            selectRect: {
                width: 100,
                height: 100,
                xOffset: 10,
                yOffset: 10
            }
        },
        nodes: {
            img: null,
            wrapper: null,
            svg: null
        },
        svgNodes: {
            backgroundRect: null,
            selectRect: null,
            cornerLeftTop: null,
            cornerRightTop: null,
            cornerLeftBottom: null,
            cornerRightBottom: null
        }
    }

    this._storeSetNode = (key, node) => {
        if (this.store.nodes[key] === undefined) {
            throw new ReferenceError('Unknown key in store.nodes')
        }
        this.store.nodes[key] = node
    }

    this._storeGetNode = (key) => {
        return this.store.nodes[key]
    }

    this._storeSetSvgNode = (key, node) => {
        if (this.store.svgNodes[key] === undefined) {
            throw new ReferenceError('Unknown key in store.svgNodes')
        }
        this.store.svgNodes[key] = node
    }

    this._storeGetSvgNode = (key) => {
        return this.store.svgNodes[key]
    }

    this.init = () => {
        const $img = document.querySelector(imgSelector)
        if ($img === null) { throw new ReferenceError('ImgNode is null') }

        const $wrapper = document.createElement('div')
        $wrapper.className = 'croppy-wrapper'

        this._storeSetNode('wrapper', $wrapper)
        this._storeSetNode('img', $img)

        const svgTemplate = `
            <svg class="croppy-svg">
                <rect class="croppy-svg-background"/>
                <rect class="croppy-svg-mask"/>
                <rect class="croppy-svg-corner croppy-svg-corner-left-top"/>
                <rect class="croppy-svg-corner croppy-svg-corner-right-top"/>
                <rect class="croppy-svg-corner croppy-svg-corner-left-bottom"/>
                <rect class="croppy-svg-corner croppy-svg-corner-right-bottom"/>
            </svg>
        `

        $settings.insertBefore($wrapper, $img) //$settings fix later
        $wrapper.innerHTML = svgTemplate
        $wrapper.append($img)

        const $svg = $wrapper.querySelector('svg')
        this._storeSetNode('svg', $svg)

        const $svgBackgroundRect = $svg.querySelector('.croppy-svg-background')
        this._storeSetSvgNode('backgroundRect', $svgBackgroundRect)

        const $svgSelectRect = $svg.querySelector('.croppy-svg-mask')
        this._storeSetSvgNode('selectRect', $svgSelectRect)
        
        $svg.setAttribute('width', $img.offsetWidth)
        $svg.setAttribute('height', $img.offsetHeight)
        $svgBackgroundRect.setAttribute('width', $img.offsetWidth)
        $svgBackgroundRect.setAttribute('height', $img.offsetHeight)
        $svgSelectRect.setAttribute('width', this.store.posData.selectRect.width)
        $svgSelectRect.setAttribute('height', this.store.posData.selectRect.height)
        $svgSelectRect.setAttribute('x', this.store.posData.selectRect.xOffset)
        $svgSelectRect.setAttribute('y', this.store.posData.selectRect.yOffset)

        const $svgCorners = {
            cornerLeftTop: $svg.querySelector('.croppy-svg-corner-left-top'),
            cornerRightTop: $svg.querySelector('.croppy-svg-corner-right-top'),
            cornerLeftBottom: $svg.querySelector('.croppy-svg-corner-left-bottom'),
            cornerRightBottom: $svg.querySelector('.croppy-svg-corner-right-bottom')
        }

        for (let key in $svgCorners) {
            this._storeSetSvgNode(key, $svgCorners[key])
        }


    }
}

let pic = require('../static/pic.jpg')
$settingsImage.src = pic
$settingsImage.onload = () => {
    const svgCroppy = new SvgCroppy('#settings-img')
    svgCroppy.init()
}


window.mineartDOM = {
    changeTool(tool) {
        mineartCanvas.setTool(tool)
    }
}

$dropzone.ondragleave = (e) => {
    e.preventDefault()
    console.log('drag OUT')
}

$dropzone.ondragover = (e) => {
    e.preventDefault()
    console.log('draggin')
}

$dropzone.ondrop = (e) => {
    e.preventDefault()
    let img = new Image()
    img.src = _URL.createObjectURL(e.dataTransfer.files[0])
    img.onload =  function() {
        $settingsImage.src = img.src
        $settingsForm.width.value = img.width
        $settingsForm.height.value = img.height
        $dropzone.classList.add('hidden')
        $settings.classList.remove('hidden')
    }

    $settingsForm.onsubmit = (e) => {
        e.preventDefault()
        let formWidth = $settingsForm.width.value
        let formHeight = $settingsForm.height.value
        mineartCanvas.setImageSizes(formWidth, formHeight)
        canvasTemp.width = formWidth
        canvasTemp.height = formHeight
        ctxTemp.imageSmoothingEnabled = false
        ctxTemp.drawImage(img, 0, 0, formWidth, formHeight)
        const imageData = ctxTemp.getImageData(0, 0, formWidth, formHeight).data
        convertWorker.postMessage(imageData)
    }
}

convertWorker.onmessage = function(e) {
    mineartCanvas.loadImageHex(e.data)
    console.log('Ended in: ' + performance.now())
}

$canvasMain.addEventListener('cached', (e) => {
    $settings.classList.add('hidden')
    $paintTable.classList.remove('hidden')
    mineartCanvas.setBound(canvasMain.getBoundingClientRect())
    mineartCanvas.render()
})
