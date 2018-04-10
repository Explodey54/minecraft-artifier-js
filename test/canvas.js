import MineartCanvas from '../app/canvas.js'
import chai from 'chai'
const assert = chai.assert

describe('MineartCanvas', function() {

    const id = 'canvasMain'
    var canvas = new MineartCanvas(id)
    

    it('inits', function() {
        assert.exists(canvas)
    })

    it('loads image hex', function() {
        const hex = "0203040506070809"
        
    })
})

// describe('yaas', function() {
//     console.log(MineartCanvas)
// })