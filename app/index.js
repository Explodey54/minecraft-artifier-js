import ConvertWorker from 'worker-loader!./convert.js'
import MineartCanvas from './canvas.js'

const _URL = window.URL || window.webkitURL

const convertWorker = new ConvertWorker()
const mineartCanvas = new MineartCanvas('canvasMain')

const canvasMain = document.getElementById('canvasMain')
const dropzone = document.getElementById('dropzone')
const paintTable = document.getElementById('paint-table')

const canvasTemp = document.createElement('canvas')
const ctxTemp = canvasTemp.getContext('2d')

let imageWidth = 100
let imageHeight = 100

window.changeTool = (tool) => {
    mineartCanvas.setTool(tool)
}

dropzone.ondragleave = (e) => {
    e.preventDefault()
    console.log('drag OUT')
}

dropzone.ondragover = (e) => {
    e.preventDefault()
    console.log('draggin')
}

dropzone.ondrop = (e) => {
    e.preventDefault()
    mineartCanvas.setImageSizes(imageWidth, imageHeight)

    let img = new Image()
    img.src = _URL.createObjectURL(e.dataTransfer.files[0])
    img.onload =  function() {
        canvasTemp.width = imageWidth
        canvasTemp.height = imageHeight
        ctxTemp.imageSmoothingEnabled = false
        ctxTemp.drawImage(img, 0, 0, imageWidth, imageHeight)
        const imageData = ctxTemp.getImageData(0, 0, imageWidth, imageHeight).data
        convertWorker.postMessage(imageData)
    }
}

convertWorker.onmessage = function(e) {
    mineartCanvas.loadImageHex(e.data)
    console.log('Ended in: ' + performance.now())
}

canvasMain.addEventListener('cached', (e) => {
    dropzone.style.display = 'none'
    paintTable.style.display = 'block'
    mineartCanvas.setBound(canvasMain.getBoundingClientRect())
    mineartCanvas.render()
})
