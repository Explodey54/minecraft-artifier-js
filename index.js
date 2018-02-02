const input = document.getElementById('inputf')
const _URL = window.URL || window.webkitURL
const canvasMain = document.getElementById('canvasMain')
const ctxMain = canvasMain.getContext('2d')
const bound = canvasMain.getBoundingClientRect()
const canvasTemp = document.createElement('canvas')
const ctxTemp = canvasTemp.getContext('2d')
const b64toBlob = require('b64-to-blob')

const store = {
    blocksDb: require('./static/baked_blocks.json'),
    colorGroups: require('./static/baked_colors.json'),
    getBlockById(id) { return this.blocksDb[id - 1] },
    imageConvertedHex: false,
    imageWidth: 300,
    imageHeight: 300,
    layers: {
        loadedImage: false,
        paintedImage: {}
    },
    canvasSettings: {
        width: 1000,
        height: 800,
        baseCellSize: 16
    },
    offset: {
        grabbed: false,
        bounds: {
            x: {
                max: 500,
                min: -500
            },
            y: {
                max: 500,
                min: -500
            }
        },
        saved: {
            x: 0,
            y: 0
        },
        temp: {
            x: 0,
            y: 0
        },
        start: {},
        translate(x, y) {
            this.saved.x = x
            this.saved.y = y
        }
    },
    scale: {
        current: 1,
        options: [0.125, 0.25, 0.5, 1, 2, 4],
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
    }
}

const mouseControls = {
    posMouse: {},
    leftClick: false
}

store.blocksDb.forEach((item) => {
    item.image = new Image()
    item.image.src = require('./static/textures/' + item.texture_image)
    delete item.texture_image
})

canvasMain.width = store.canvasSettings.width;
canvasMain.height = store.canvasSettings.height;

function rgbToHsl(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function getColorGroupHSL(h, s, l) {
    if (l <= 7 || (l <= 20 && s <= 10)) { return 'black' } 
    else if (l >= 93 || (l >= 80 && s <= 10)) { return 'white' } 
    else if (s <= 10) { return 'gray' }
    else {
        if (h > 335 || h <= 10) { return 'red' }
        else if (h > 10 && h <= 45) { return 'orange' }
        else if (h > 45 && h <= 75) { return 'yellow' }
        else if (h > 75 && h <= 150) { return 'green' }
        else if (h > 150 && h <= 200) { return 'lightblue' }
        else if (h > 200 && h <= 260) { return 'blue' }
        else if (h > 260 && h <= 335) { return 'purple' }
    }
}

function findSimilarBlocks(image) {
    let output = ''
    // const deviation = 40
    // const deviationHalf = Math.round(deviation / 2)

    for (let x in image) {
        for (let y in image[x]) {
            let pixel = image[x][y]
            let pixelHsl = rgbToHsl(pixel.red, pixel.green, pixel.blue)
            let colorName = getColorGroupHSL(pixelHsl[0], pixelHsl[1], pixelHsl[2])
            let temp = false
            
            store.colorGroups[colorName].forEach((item) => {
                let dev = Math.abs(pixelHsl[0] - item.hsl[0] + pixelHsl[1] - item.hsl[1] + pixelHsl[2] - item.hsl[2])
                if (!temp || temp.deviation > dev) {
                    temp = item
                    temp.deviation = dev
                }
            })
            if (temp.id < 16) {
                output += '0' + temp.id.toString(16)
            } else {
                output += temp.id.toString(16)
            }
        }
    }
    return output
}



function render() {
    function renderByLoop() {
        let topLeftX = Math.floor((-store.offset.saved.x) / store.canvasSettings.baseCellSize / store.scale.current)
        let topLeftY = Math.floor((-store.offset.saved.y) / store.canvasSettings.baseCellSize / store.scale.current)
        let bottomRightX = Math.floor((store.canvasSettings.width - store.offset.saved.x) / store.canvasSettings.baseCellSize / store.scale.current)
        let bottomRightY = Math.floor((store.canvasSettings.height - store.offset.saved.y) / store.canvasSettings.baseCellSize / store.scale.current)

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

        var sliceBegin = 2 * (topLeftY * store.imageWidth + topLeftX)
        var sliceEnd = 2 * (bottomRightY * store.imageWidth + bottomRightX + 1) 
        let hexSlice = store.imageConvertedHex.slice(sliceBegin, sliceEnd)
        ctxMain.clearRect(0, 0, store.canvasSettings.width, store.canvasSettings.height)
        for (let y = topLeftY; y <= bottomRightY; y++) {
            for (let x = topLeftX; x <= bottomRightX; x++) {
                if (x < store.imageWidth && y < store.imageHeight) {
                    let sliceSingleBegin = 2 * (y * store.imageWidth + x) - sliceBegin
                    let hexBlock = hexSlice.slice(sliceSingleBegin, sliceSingleBegin + 2)
                    let imageForCanvas = store.getBlockById(parseInt(hexBlock, 16)).image
                    ctxMain.drawImage(imageForCanvas, x * 16 * store.scale.current + store.offset.saved.x, y * 16 * store.scale.current + store.offset.saved.y, store.scale.current * 16, store.scale.current * 16)
                }
            }
        }
    }

    function renderByCache() {
        let t0 = performance.now()
        ctxMain.clearRect(0, 0, store.canvasSettings.width, store.canvasSettings.height)
        if (!store.layers.loadedImage) {
            canvasTemp.width = store.imageWidth * 16
            canvasTemp.height = store.imageHeight * 16

            const hexLength = store.imageConvertedHex.length
            for (let i = 0; i < hexLength; i += 2) {
                let x = ((i / 2)) % store.imageWidth + 1
                let y = Math.ceil((i + 1) / 2 / store.imageHeight)
                let imageForCanvas = store.getBlockById(parseInt(store.imageConvertedHex.slice(i, i + 2), 16)).image
                ctxTemp.drawImage(imageForCanvas, (x - 1) * 16, (y - 1) * 16)
            }

            store.layers.loadedImage = new Image()
            let blob = b64toBlob(canvasTemp.toDataURL().slice(22), 'image/png')

            store.layers.loadedImage.src = _URL.createObjectURL(blob)
            store.layers.loadedImage.onload = () => {
                render()
            }
        } else {
            ctxMain.drawImage(store.layers.loadedImage, store.offset.saved.x, store.offset.saved.y, store.imageWidth * 16 * store.scale.current, store.imageHeight * 16 * store.scale.current)
        }
    }

    if (store.scale.current > 1) {
        renderByLoop()
    } else {
        renderByCache()
    }
}

input.addEventListener('change', (e) => {
  let img = new Image()
  img.src = _URL.createObjectURL(input.files[0])
  img.onload =  function() {
    const output = {}
    canvasTemp.width = store.imageWidth
    canvasTemp.height = store.imageHeight
    ctxTemp.imageSmoothingEnabled = false
    ctxMain.imageSmoothingEnabled = false
    ctxTemp.drawImage(img, 0, 0, store.imageWidth, store.imageHeight)
    const imageData = ctxTemp.getImageData(0, 0, store.imageWidth, store.imageHeight).data
    ctxTemp.clearRect(0, 0, canvasTemp.width, canvasTemp.height)

    for (let i = 0; i < imageData.length; i++) {
      let x = Math.floor(i / 4 / store.imageWidth) + 1
      let y = Math.floor(i / 4) % store.imageHeight + 1
      if (output['x' + x] === undefined) {
        output['x' + x] = {}
      }
      if (output['x' + x]['y' + y] === undefined) {
        output['x' + x]['y' + y] = {}
      }
      let pointer = output['x' + x]['y' + y]
      if (i % 4 === 0) {
        pointer.red = imageData[i]
      }
      if (i % 4 === 1) {
        pointer.green = imageData[i]
      }
      if (i % 4 === 2) {
        pointer.blue = imageData[i]
      }
    }

    store.imageConvertedHex = findSimilarBlocks(output)
    render()
    console.log('done')
  }

})

$(canvasMain).mousemove(function(e) {
    mouseControls.posMouse.x = e.clientX - bound.x
    mouseControls.posMouse.y = e.clientY - bound.y
    if (store.offset.grabbed) {
        store.offset.translate(mouseControls.posMouse.x - store.offset.start.x + store.offset.temp.x, mouseControls.posMouse.y - store.offset.start.y + store.offset.temp.y)
        // if (offsetNewX <= store.offset.bounds.x.max) {
        //     store.offset.saved.x = offsetNewX
        // } else {
        //     store.offset.saved.x = store.offset.bounds.x.max
        // }
        // if (offsetNewX <= 500) {
        //     store.offset.saved.x = offsetNewX
        // } else {
        //     store.offset.saved.x = 500
        // }

        // if (offsetNewY <= 500) {
        //     store.offset.saved.y = offsetNewY
        // } else {
        //     store.offset.saved.y = 500
        // }
        render()
    }
    // if (mouseControls.leftClick) {
    //     let xBlock = (Math.floor((mouseControls.posMouse.x - store.offset.saved.x) / store.canvasSettings.baseCellSize / store.scale.current + 1))
    //     let yBlock = (Math.floor((mouseControls.posMouse.y - store.offset.saved.y) / store.canvasSettings.baseCellSize / store.scale.current + 1))
    //     paint(xBlock, yBlock, 44)
    //     render()
    // }
});

$(canvasMain).mousedown(function (e) {
    if (e.which === 1) {
        mouseControls.leftClick = true
        let xBlock = (Math.floor((mouseControls.posMouse.x - store.offset.saved.x) / store.canvasSettings.baseCellSize * store.scale.current + 1))
        let yBlock = (Math.floor((mouseControls.posMouse.y - store.offset.saved.y) / store.canvasSettings.baseCellSize * store.scale.current + 1))
        // paint(xBlock, yBlock, 44)
        render()
    }
    if (e.which === 2) {
        e.preventDefault()
        store.offset.grabbed = true
        store.offset.start.x = e.clientX - bound.x
        store.offset.start.y = e.clientY - bound.y
    }
});

$(document).mouseup(function (e) {
    console.log(store.offset.saved)
    store.offset.temp.x = store.offset.saved.x
    store.offset.temp.y = store.offset.saved.y
    store.offset.grabbed = false
    mouseControls.leftClick = false
});

canvasMain.addEventListener("wheel", (e) => {
    if (e.deltaY < 0) {
        if (store.scale.scaleUp()) {
            let x = Math.floor(mouseControls.posMouse.x - store.offset.saved.x)
            let y = Math.floor(mouseControls.posMouse.y - store.offset.saved.y)
            store.offset.temp.x = store.offset.saved.x - x
            store.offset.temp.y = store.offset.saved.y - y
            store.offset.translate(store.offset.saved.x - x, store.offset.saved.y - y)

            render()
        }
    }

    if (e.deltaY > 0) {
        if (store.scale.scaleDown()) {
            let x = Math.floor(mouseControls.posMouse.x - store.offset.saved.x)
            let y = Math.floor(mouseControls.posMouse.y - store.offset.saved.y)
            store.offset.temp.x = store.offset.saved.x + x / 2
            store.offset.temp.y = store.offset.saved.y + y / 2
            store.offset.translate(store.offset.saved.x + x / 2, store.offset.saved.y + y / 2)

            render()
        }
    }
});