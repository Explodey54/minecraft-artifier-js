import './style.css'

import ConvertWorker from 'worker-loader!./convert.js'
import MineartCanvas from './canvas.js'
import SvgCroppy from './svgCroppy.js'

const _URL = window.URL || window.webkitURL

const convertWorker = new ConvertWorker()
const mineartCanvas = new MineartCanvas('canvasMain')

const $canvasMain = document.getElementById('canvasMain')
const $canvasOverlay = document.getElementById('canvasOverlay')
const $dropzone = document.getElementById('dropzone')
const $paintTable = document.getElementById('paint-table')
const $settings = document.getElementById('settings')

const $settingsImage = document.getElementById('settings-img')
const $settingsForm = document.getElementById('settings-form')

const canvasTemp = document.createElement('canvas')
const ctxTemp = canvasTemp.getContext('2d')

const history = {}
const $historyBlock = document.querySelector('.info-area-history-actions-block')

const testImage = new Image()
testImage.src = require('../static/pic_200.png')
testImage.onload = () => {
    mineartCanvas.setImageSizes(200, 200)
    canvasTemp.width = 200
    canvasTemp.height = 200
    ctxTemp.imageSmoothingEnabled = false
    ctxTemp.drawImage(testImage, 
                      0, 
                      0, 
                      testImage.width, 
                      testImage.height)
    const imageData = ctxTemp.getImageData(0, 0, 200, 200).data
    convertWorker.postMessage(imageData)
}

window.mineartDOM = {
    changeTool(tool) {
        mineartCanvas.setTool(tool)
    },
    testShowPainted() {
        return mineartCanvas.debugRenderAllPainted()
    },
    plusOneBrushSize() {
        mineartCanvas.addToBrushSize(1)
    },
    minusOneBrushSize() {
        mineartCanvas.addToBrushSize(-1)
    },
    undo() {
        mineartCanvas.undoOnce()
    },
    logStore() {
        return mineartCanvas._debugReturnStore()
    },
    debugSaveHistory() {
        mineartCanvas._debugSaveHistory()
    },
    debugCompareHistory() {
        return mineartCanvas._debugCompareHistory()
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
    const $img = document.querySelector('#settings-img')
    const svgCroppy = new SvgCroppy($img)
    let img = new Image()
    img.src = _URL.createObjectURL(e.dataTransfer.files[0])
    img.onload =  function() {
        $settingsImage.src = img.src
        $dropzone.classList.add('hidden')
        $settings.classList.remove('hidden')

        svgCroppy.init()

        const cropInfo = svgCroppy.getCropInfo()
        $settingsForm.width.value = Math.round(cropInfo.width / cropInfo.boundWidth * img.width)
        $settingsForm.height.value = Math.round(cropInfo.height / cropInfo.boundHeight * img.height)

        $img.addEventListener('croppytransformed', (e) => {
            const cropInfo = svgCroppy.getCropInfo()
            $settingsForm.width.value = Math.round(cropInfo.width / cropInfo.boundWidth * img.width)
            $settingsForm.height.value = Math.round(cropInfo.height / cropInfo.boundHeight * img.height)
        })
    }

    $settingsForm.onsubmit = (e) => {
        e.preventDefault()
        const cropInfo = svgCroppy.getCropInfo()
        const formWidth = $settingsForm.width.value
        const formHeight = $settingsForm.height.value
        mineartCanvas.setImageSizes(formWidth, formHeight)
        canvasTemp.width = formWidth
        canvasTemp.height = formHeight
        ctxTemp.imageSmoothingEnabled = false
        ctxTemp.drawImage(img, 
                          img.width / cropInfo.boundWidth * -cropInfo.offsetX, 
                          img.height / cropInfo.boundHeight * -cropInfo.offsetY, 
                          img.width, 
                          img.height)
        const imageData = ctxTemp.getImageData(0, 0, formWidth, formHeight).data
        convertWorker.postMessage(imageData)

        document.querySelector('.info-area-span-width').innerHTML = formWidth
        document.querySelector('.info-area-span-height').innerHTML = formHeight
    }
}

convertWorker.onmessage = function(e) {
    mineartCanvas.loadImageHex(e.data)
    console.log('Ended converting in: ' + performance.now())
}

$canvasMain.addEventListener('cached', (e) => {
    $settings.classList.add('hidden')
    $paintTable.classList.remove('hidden')
    mineartCanvas.setBoundingRect(canvasMain.getBoundingClientRect())
    mineartCanvas.render()
})

function historyActionOnClick() {
    const thisActionPos = parseInt(this.dataset.actionPos)
    const actions = document.querySelectorAll('.info-area-history-action')
    mineartCanvas.undoTo(thisActionPos)
    actions.forEach((item) => {
        let itemActionPos = parseInt(item.getAttribute('data-action-pos'))
        if (itemActionPos > thisActionPos) {
            item.classList.add('info-area-history-action-returned')
        }
        if (itemActionPos <= thisActionPos) {
            item.classList.remove('info-area-history-action-returned')
        }
    })
}

$canvasMain.addEventListener('history', (e) => {
    const actions = document.querySelectorAll('.info-area-history-action')
    actions.forEach((item, i) => {
        let itemActionPos = parseInt(item.getAttribute('data-action-pos'))
        if (itemActionPos >= e.details.pos) {
            item.remove()
        }
    })

    const $historyAction = document.createElement('div')
    $historyAction.innerHTML = e.details.type
    $historyAction.className = "info-area-history-action"
    $historyAction.setAttribute('data-action-pos', e.details.pos)
    $historyAction.onclick = historyActionOnClick
    $historyBlock.appendChild($historyAction)
})

$canvasOverlay.addEventListener('mousemove', (e) => {
    const blockInfo = mineartCanvas.getBlockInfoByMouseXY(e.pageX, e.pageY)
    if (blockInfo.info) {
        document.querySelector('.info-area-span-block-x').innerHTML = blockInfo.x + 1
        document.querySelector('.info-area-span-block-y').innerHTML = blockInfo.y + 1
        document.querySelector('.info-area-span-block-name').innerHTML = blockInfo.info.name
        document.querySelector('.info-area-span-block-img').src = blockInfo.info.image.src
    }
})

document.querySelector('.info-area-history-action-start').onclick = historyActionOnClick