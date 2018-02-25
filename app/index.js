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
