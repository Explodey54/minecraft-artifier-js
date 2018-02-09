const colorGroups = require('../static/baked_colors.json')

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

onmessage = function(e) {
    console.log('Started in: ' + performance.now())
    
    const imageData = e.data
    let output = ''

    if (imageData.constructor.name != 'Uint8ClampedArray') {
        console.log('not uint8!!!')
        return
    }
    
    for (let i = 0; i < imageData.length; i += 4) {
        let pixelHsl = rgbToHsl(imageData[i], imageData[i + 1], imageData[i + 2])
        let colorName = getColorGroupHSL(pixelHsl[0], pixelHsl[1], pixelHsl[2])
        let temp = false
        colorGroups[colorName].forEach((item) => {
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

    postMessage(output)
}
