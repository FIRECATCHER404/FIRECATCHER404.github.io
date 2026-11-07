export const MATERIALS=Object.freeze({
  wood:{name:'Wood',color:'#ab8053',density:.65,friction:.55,restitution:.18,impact:45,crush:650,roughness:.85,metalness:0},
  glass:{name:'Glass',color:'#9acbd2',density:2.5,friction:.25,restitution:.08,impact:7,crush:200,roughness:.12,metalness:.05,opacity:.48},
  stone:{name:'Stone',color:'#9b9a90',density:2.7,friction:.75,restitution:.12,impact:85,crush:1500,roughness:1,metalness:0},
  steel:{name:'Steel',color:'#aebbc0',density:7.8,friction:.6,restitution:.05,impact:10000,crush:100000,roughness:.3,metalness:.75},
  ice:{name:'Ice',color:'#c2e7ef',density:.92,friction:.08,restitution:.1,impact:5,crush:100,roughness:.3,metalness:0,opacity:.85},
  rubber:{name:'Rubber',color:'#c48158',density:1.1,friction:.9,restitution:.82,impact:1e12,crush:1e12,roughness:.92,metalness:0,unbreakable:true}
});
export const SHAPES={box:'Box',sphere:'Sphere',cylinder:'Cylinder',tetra:'Tetrahedron'};
