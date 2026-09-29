import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { db, json } from '../src/lib/db';
import { Question, CONFIG_VERSION } from '../src/lib/contracts';
async function main(){
 if(!process.env.DATABASE_URL?.includes('istima_test'))throw new Error('Fixture browser hanya boleh berada di istima_test.');
 await db.user.deleteMany({where:{email:{endsWith:'@e2e.example.invalid'}}});
 await db.question.deleteMany({where:{id:{startsWith:'e2e-'}}});await db.unit.deleteMany({where:{id:{startsWith:'e2e-'}}});
 if(process.argv.includes('--cleanup'))return;
 await mkdir('public/media',{recursive:true});
 const sampleRate=16000,samples=3200,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i/sampleRate*440*Math.PI*2)*2000),44+i*2);await writeFile('public/media/test-tone.wav',wav);
 await writeFile('public/media/test-image.svg','<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#194d3c"/></svg>');
 const types=Object.keys({pilihan_ganda:1,urutkan:1,dikte:1,beda_bunyi:1,pilih_gambar:1}) as Question['type'][];
 for(let level=1;level<=5;level++){
  const unitId=`e2e-unit-${level}`;await db.unit.create({data:{id:unitId,level,title:`E2E Level ${level}`,theme:'test',description:'Fixture teknis, bukan materi bahasa Arab.'}});
  for(const pool of ['practice','assessment'] as const)for(let i=0;i<(pool==='practice'?5:10);i++){
   const type=types[i%5],audio={url:'/media/test-tone.wav',duration:.2,native:false,reviewed:false,license:'Generated test tone; not native speech'};
   const q:Question={id:`e2e-${pool}-${level}-${i}`,unitId,version:1,level,pool,type,prompt:`Fixture ${type}`,category:'fixture',audio:type==='beda_bunyi'?[audio,audio]:[audio],options:type==='dikte'?[]:[{id:'a',text:type==='urutkan'?'أنا':'أ',...(type==='pilih_gambar'?{image:'/media/test-image.svg',license:'Test fixture'}:{})},{id:'b',text:type==='urutkan'?'هنا':'ب',...(type==='pilih_gambar'?{image:'/media/test-image.svg',license:'Test fixture'}:{})}],accepted:type==='urutkan'?[['a','b']]:type==='dikte'?['أَنا.']:['a'],transcript:'Fixture transcript',explanation:'Fixture explanation',seconds:30,harakat:'full'};
   // Only the isolated test database contains published synthetic fixtures.
   await db.question.create({data:{id:q.id,unitId,level,pool,status:'published',data:json(q)}});
  }
 }
 for(const profile of ['desktop','mobile'])await db.user.create({data:{email:`${profile}@e2e.example.invalid`,name:`E2E ${profile}`,passwordHash:await bcrypt.hash('E2e-only-listening-2026',12),verifiedAt:new Date(),onboarding:false}});
 await db.reviewConfig.upsert({where:{id:CONFIG_VERSION},create:{id:CONFIG_VERSION,approved:true,reviewer:'E2E fixture'},update:{approved:true,reviewer:'E2E fixture'}});
 console.log('Fixture browser siap di istima_test. Jangan gunakan sebagai konten publik.');
}
main().finally(()=>db.$disconnect());
