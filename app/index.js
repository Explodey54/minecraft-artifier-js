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

function CanvasCrop(imgSelector) {
    this.$imgNode = document.querySelector(imgSelector)
    if (this.$imgNode === null) { throw new TypeError('ImgNode is null') }

    this.$wrapper = document.createElement('div')
    this.$wrapper.className = 'cropper-wrapper'

    this.$svg = `
        <svg class="cropper-svg">
            <rect class="cropper-svg-background"/>
            <rect class="cropper-svg-mask"/>
        </svg>
    `
    this.$svgFigures = {
        backgroundRect: null
    }

    this.init = () => {
        $settings.insertBefore(this.$wrapper, this.$imgNode)
        this.$wrapper.innerHTML = this.$svg
        this.$wrapper.append(this.$imgNode)

        this.$svg = this.$wrapper.querySelector('svg')
        this.$svgFigures.backgroundRect = this.$svg.querySelector('.cropper-svg-background')
        
        this.$svg.setAttribute('width', this.$imgNode.offsetWidth)
        this.$svg.setAttribute('height', this.$imgNode.offsetHeight)
        this.$svgFigures.backgroundRect.setAttribute('width', this.$imgNode.offsetWidth)
        this.$svgFigures.backgroundRect.setAttribute('height', this.$imgNode.offsetHeight)
    }
}

let pic = require('../static/pic.jpg')
$settingsImage.src = pic
$settingsImage.onload = () => {
    const canvasCrop = new CanvasCrop('#settings-img')
    canvasCrop.init()
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
