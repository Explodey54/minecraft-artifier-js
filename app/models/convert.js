const blocks = require('../../static/baked_blocks.json')

// function findSimilarBlocks(image) {
//     let output = ''

//     for (let x in image) {
//         for (let y in image[x]) {
//             let pixel = image[x][y]
//             let pixelHsl = rgbToHsl(pixel.red, pixel.green, pixel.blue)
//             let colorName = getColorGroupHSL(pixelHsl[0], pixelHsl[1], pixelHsl[2])
//             let temp = false
            
//             store.colorGroups[colorName].forEach((item) => {
//                 let dev = Math.abs(pixelHsl[0] - item.hsl[0] + pixelHsl[1] - item.hsl[1] + pixelHsl[2] - item.hsl[2])
//                 if (!temp || temp.deviation > dev) {
//                     temp = item
//                     temp.deviation = dev
//                 }
//             })
//             if (temp.id < 16) {
//                 output += '0' + temp.id.toString(16)
//             } else {
//                 output += temp.id.toString(16)
//             }
//         }
//     }
//     return output
// }

onmessage = function(e) {
    e.data.exclude.forEach((item) => {
        delete blocks[item - 1]
    })

    console.log('Started converting in: ' + performance.now())
    
    const imageData = e.data.imgData

    if (imageData.constructor.name != 'Uint8ClampedArray') {
        console.log('not uint8!!!')
        return
    }

    let output = new Uint8ClampedArray(imageData.length / 4)
    
    for (let i = 0; i < imageData.length; i += 4) {
        let pixelRgb = {
            red: imageData[i],
            green: imageData[i + 1],
            blue: imageData[i + 2],
            alpha: imageData[i + 3]
        }
        if (pixelRgb.alpha > 10) {
            let temp = false
            blocks.forEach((item) => {
                let dev = Math.abs(pixelRgb.red - item.red) + Math.abs(pixelRgb.green - item.green) + Math.abs(pixelRgb.blue - item.blue)
                if (!temp || dev < temp.deviation) {
                    temp = item
                    temp.deviation = dev
                }
            })
            output[i / 4] = temp.id
        } else {
            output[i / 4] = 0
        }

    }

    postMessage(output)
}
