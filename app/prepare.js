const path = require('path')
const Jimp = require("jimp")
const fs = require('fs')
const blocksDb = require('../static/blocks_12.json')
const arr = []
const colors = []

// function rgbToHsl(r, g, b){
//     r /= 255, g /= 255, b /= 255;
//     var max = Math.max(r, g, b), min = Math.min(r, g, b);
//     var h, s, l = (max + min) / 2;

//     if(max == min){
//         h = s = 0; // achromatic
//     }else{
//         var d = max - min;
//         s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
//         switch(max){
//             case r: h = (g - b) / d + (g < b ? 6 : 0); break;
//             case g: h = (b - r) / d + 2; break;
//             case b: h = (r - g) / d + 4; break;
//         }
//         h /= 6;
//     }

//     return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
// }
  
blocksDb.forEach((item, i) => {
    item.id = i + 1
    arr.push(Jimp.read('../static/textures/' + item.texture_image).then(function (image) {
        let redSum = 0
        let greenSum = 0
        let blueSum = 0

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            redSum += this.bitmap.data[ idx + 0 ]
            greenSum += this.bitmap.data[ idx + 1 ]
            blueSum += this.bitmap.data[ idx + 2 ]
        })
        
        let red = Math.round(redSum / (image.bitmap.width * image.bitmap.height))
        let green = Math.round(greenSum / (image.bitmap.width * image.bitmap.height))
        let blue = Math.round(blueSum / (image.bitmap.width * image.bitmap.height))

        item.red = red
        item.green = green
        item.blue = blue

        // colors.push({
        //     id: item.id,
        //     red: red,
        //     green: green,
        //     blue: blue
        // })
    }))
})

Promise.all(arr).then(() => {
  // fs.writeFile(path.join(__dirname, '../static/baked_colors.json'), JSON.stringify(colors), function(err) {
  //   if(err) {
  //       return console.log(err);
  //   }
  // })
  fs.writeFile(path.join(__dirname, '../static/baked_blocks.json'), JSON.stringify(blocksDb), function(err) {
    if(err) {
        return console.log(err);
    }
  })
}, reject => {
  console.log(reject)
})
