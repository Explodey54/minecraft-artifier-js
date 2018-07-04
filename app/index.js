// import './style.css'
import './style2.css'
import 'bulma/css/bulma.css'

import ConvertWorker from 'worker-loader!./convert.js'
import MineartCanvas from './canvas.js'
import SvgCroppy from './svgCroppy.js'

const blocks = require('../static/baked_blocks.json')
blocks.forEach((item) => {
    item.image = new Image()
    item.image.src = require('../static/textures/' + item.texture_image)
    delete item.texture_image
})

const canvasTemp = document.createElement('canvas'),
      ctxTemp = canvasTemp.getContext('2d'),
      convertWorker = new ConvertWorker()

const $canvasDiv = document.getElementById('canvasMain'),
      boundRectCanvasDiv = $canvasDiv.getBoundingClientRect(),
      mineartCanvas = new MineartCanvas($canvasDiv, boundRectCanvasDiv.width, boundRectCanvasDiv.height)

mineartCanvas.setBoundingRect(boundRectCanvasDiv)
mineartCanvas.setBlocks(blocks)

const testImage = new Image()
testImage.src = require('../static/lum_300.png')
testImage.onload = () => {
    let w = 300
    let h = 300
    mineartCanvas.setImageSizes(w, h)
    canvasTemp.width = w
    canvasTemp.height = h
    ctxTemp.imageSmoothingEnabled = false
    ctxTemp.drawImage(testImage, 
                      0, 
                      0, 
                      testImage.width, 
                      testImage.height)
    const imageData = ctxTemp.getImageData(0, 0, w, h).data
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
    },
    replace(target, replace) {
        return mineartCanvas.replace(target, replace)
    },
    setEyedrop(id) {
        mineartCanvas.setEyedrop(id)
    },
    save() {
        return mineartCanvas.save()
    },
    open() {
        mineartCanvas.open()
    },
    convert() {
        return mineartCanvas.convert()
    }
}

const $historyBlock = document.querySelector('.info-panels-history-container')

function setEyedrop(id) {
    $eyedropImg.src = blocks[id - 1].image.src
    mineartCanvas.setEyedrop(id)
}

const $blocks = document.querySelector('.info-panels-blocks-img')
blocks.forEach((item) => {
    item.image.classList.add('img-pixelated')
    item.image.title = item.name
    item.image.onclick = () => {
        setEyedrop(item.id)
    }
    $blocks.appendChild(item.image)
})

const $inputBlockSearch = document.querySelector('#input-block-search')
$inputBlockSearch.oninput = (e) => {
    const regex = new RegExp($inputBlockSearch.value, 'i') 
    blocks.forEach((item) => {
        if (item.name.search(regex) < 0) {
            item.image.classList.add('hidden')
        } else {
            item.image.classList.remove('hidden')
        }
    })
}

const $mineartCanvasLink = mineartCanvas.getCanvasLink()

function historyActionOnClick() {
    const thisActionPos = parseInt(this.dataset.actionPos)
    const actions = document.querySelectorAll('.info-panels-history-action')
    mineartCanvas.undoTo(thisActionPos)
    actions.forEach((item) => {
        let itemActionPos = parseInt(item.getAttribute('data-action-pos'))
        if (itemActionPos > thisActionPos) {
            item.classList.add('info-panels-history-action-returned')
        }
        if (itemActionPos <= thisActionPos) {
            item.classList.remove('info-panels-history-action-returned')
        }
    })
}

const $eyedropImg = document.querySelector('.editor-eyedrop img')

$mineartCanvasLink.addEventListener('history', (e) => {
    const actions = document.querySelectorAll('.info-panels-history-action')
    actions.forEach((item, i) => {
        let itemActionPos = parseInt(item.getAttribute('data-action-pos'))
        if (itemActionPos >= e.details.pos) {
            item.remove()
        }
    })

    const $historyAction = document.createElement('div')
    $historyAction.innerHTML = e.details.type
    $historyAction.className = "info-panels-history-action"
    $historyAction.setAttribute('data-action-pos', e.details.pos)
    $historyAction.onclick = historyActionOnClick
    $historyBlock.appendChild($historyAction)
})

// const $dropzone = document.getElementById('dropzone')
// const $paintTable = document.getElementById('paint-table')
// const $settings = document.getElementById('settings')

// const $settingsImage = document.getElementById('settings-img')
// const $settingsForm = document.getElementById('settings-form')

// const history = {}

// $dropzone.ondragleave = (e) => {
//     e.preventDefault()
//     console.log('drag OUT')
// }

// $dropzone.ondragover = (e) => {
//     e.preventDefault()
//     console.log('draggin')
// }

// $dropzone.ondrop = (e) => {
//     e.preventDefault()
//     const $img = document.querySelector('#settings-img')
//     const svgCroppy = new SvgCroppy($img)
//     let img = new Image()
//     img.src = _URL.createObjectURL(e.dataTransfer.files[0])
//     img.onload =  function() {
//         $settingsImage.src = img.src
//         $dropzone.classList.add('hidden')
//         $settings.classList.remove('hidden')

//         svgCroppy.init()

//         const cropInfo = svgCroppy.getCropInfo()
//         $settingsForm.width.value = Math.round(cropInfo.width / cropInfo.boundWidth * img.width)
//         $settingsForm.height.value = Math.round(cropInfo.height / cropInfo.boundHeight * img.height)

//         $img.addEventListener('croppytransformed', (e) => {
//             const cropInfo = svgCroppy.getCropInfo()
//             $settingsForm.width.value = Math.round(cropInfo.width / cropInfo.boundWidth * img.width)
//             $settingsForm.height.value = Math.round(cropInfo.height / cropInfo.boundHeight * img.height)
//         })
//     }

//     $settingsForm.onsubmit = (e) => {
//         e.preventDefault()
//         const cropInfo = svgCroppy.getCropInfo()
//         const formWidth = $settingsForm.width.value
//         const formHeight = $settingsForm.height.value
//         mineartCanvas.setImageSizes(formWidth, formHeight)
//         canvasTemp.width = formWidth
//         canvasTemp.height = formHeight
//         ctxTemp.imageSmoothingEnabled = false
//         ctxTemp.drawImage(img, 
//                           img.width / cropInfo.boundWidth * -cropInfo.offsetX, 
//                           img.height / cropInfo.boundHeight * -cropInfo.offsetY, 
//                           img.width, 
//                           img.height)
//         const imageData = ctxTemp.getImageData(0, 0, formWidth, formHeight).data
//         convertWorker.postMessage(imageData)

//         document.querySelector('.info-area-span-width').innerHTML = formWidth
//         document.querySelector('.info-area-span-height').innerHTML = formHeight
//     }
// }

convertWorker.onmessage = function(e) {
    mineartCanvas.loadImageHex(e.data)
    console.log('Ended converting in: ' + performance.now())
}

// $mineartCanvasLink.addEventListener('cached', (e) => {
//     // $settings.classList.add('hidden')
//     // $paintTable.classList.remove('hidden')
    // mineartCanvas.setBoundingRect($mineartCanvasLink.getBoundingClientRect())
//     mineartCanvas.render()
// })

document.querySelectorAll('div.delete').forEach((item) => {
    item.onclick = () => {
        item.parentNode.classList.add('hidden')
    }
})

document.querySelectorAll('div.topbar-btn').forEach((item) => {
    item.onclick = (e) => {
        if (e.target !== item) { return }
        const submenu = item.querySelector('.topbar-menu')
        if (submenu) {
            submenu.classList.toggle('hidden')
        }
    }
})

document.querySelector('.info-panels-history-action-start').onclick = historyActionOnClick
setEyedrop(1)

//Replace Menu///////////

const storeReplaceMenu = {
    nodes: {
        $targetImgDiv: document.getElementById('replace-target-img'),
        $replaceImgDiv: document.getElementById('replace-replace-img'),
        $replaceBtn: document.getElementById('replace-btn'),
        $replaceTextInfo: document.getElementById('replace-text-info')
    },
    eyedropListener: null,
    setEyedropListener(node) {
        if (this.eyedropListener) {
            this.eyedropListener.classList.remove('active')
        }
        node.classList.add('active')
        this.eyedropListener = node
    },
    removeEyedropListener() {
        if (this.eyedropListener) {
            this.eyedropListener.classList.remove('active')
            this.eyedropListener = null
        }
    },
    addTextInfo(text, error) {
        this.nodes.$replaceTextInfo.innerHTML = text
        this.nodes.$replaceTextInfo.classList.remove('hidden')
        if (error === true) {
            this.nodes.$replaceTextInfo.classList.add('error')
        } else {
            this.nodes.$replaceTextInfo.classList.remove('error')
        }
    },
    removeTextInfo() {
        this.nodes.$replaceTextInfo.innerHTML = ''
        this.nodes.$replaceTextInfo.classList.add('hidden')
    }
}

storeReplaceMenu.nodes.$targetImgDiv.onclick = () => {
    storeReplaceMenu.setEyedropListener(storeReplaceMenu.nodes.$targetImgDiv)
    storeReplaceMenu.removeTextInfo()
}

storeReplaceMenu.nodes.$replaceImgDiv.onclick = () => {
    storeReplaceMenu.setEyedropListener(storeReplaceMenu.nodes.$replaceImgDiv)
    storeReplaceMenu.removeTextInfo()
}

storeReplaceMenu.nodes.$replaceBtn.onclick = () => {
    const targetId = parseInt(storeReplaceMenu.nodes.$targetImgDiv.getAttribute('data-blockId'))
    const replaceId = parseInt(storeReplaceMenu.nodes.$replaceImgDiv.getAttribute('data-blockId'))
    if (!targetId || !replaceId) {
        storeReplaceMenu.addTextInfo('There must be both blocks present.', true)
        return
    }
    const replaceNum = mineartDOM.replace(targetId, replaceId)
    storeReplaceMenu.addTextInfo(`Replaced ${replaceNum} block(s).`, false)
}

$mineartCanvasLink.addEventListener('click', (e) => {
    const blockInfo = mineartCanvas.getBlockInfoByMouseXY(e.pageX, e.pageY)
    if (!blockInfo.info) { return }
    console.log((300 - blockInfo.y) * 300 + blockInfo.x - 1)
    if (storeReplaceMenu.eyedropListener && blockInfo.id !== undefined) {
        storeReplaceMenu.eyedropListener.setAttribute('data-blockId', blockInfo.id)
        storeReplaceMenu.eyedropListener.src = blocks[blockInfo.id - 1].image.src
        const nearSpan = storeReplaceMenu.eyedropListener.parentNode.querySelector('span')
        if (nearSpan) {
            nearSpan.innerHTML = blockInfo.name
        }
        storeReplaceMenu.removeEyedropListener()
    }
})

//////////////////////////////////

const $savebtn = document.getElementById('save-btn')
$savebtn.onclick = () => {
    const link = mineartDOM.save()
    $savebtn.href = link
    $savebtn.download = 'pepe.json'
}

const $convertbtn = document.getElementById('convert-btn')
$convertbtn.onclick = () => {
    const link = mineartDOM.convert()
    $convertbtn.href = link
    $convertbtn.download = 'art.mcfunction'
}

const $openBtn = document.getElementById('open-btn')
$openBtn.onclick = () => {
    mineartDOM.open()
}