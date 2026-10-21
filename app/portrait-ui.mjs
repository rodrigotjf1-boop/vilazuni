export async function preparePortrait(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('Selecione JPEG, PNG ou WebP de até 12 MB.');
 const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível ler a foto.'));reader.readAsDataURL(file);});
 const image=new Image();image.src=url;await image.decode();if(!image.width||!image.height||image.width*image.height>40000000)throw Error('Use uma foto com dimensões menores.');
 const canvas=document.createElement('canvas'),edge=Math.min(image.width,image.height);canvas.width=600;canvas.height=600;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,600,600);context.drawImage(image,(image.width-edge)/2,(image.height-edge)/2,edge,edge,0,0,600,600);return canvas.toDataURL('image/jpeg',.85);
}
