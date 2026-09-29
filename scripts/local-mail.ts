import { SMTPServer } from 'smtp-server';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const server=new SMTPServer({authOptional:true,disabledCommands:['STARTTLS','AUTH'],onData(stream,_session,callback){let raw='';stream.on('data',chunk=>{raw+=chunk.toString();});stream.on('end',()=>{void (async()=>{await mkdir('.local-runtime/mail',{recursive:true});await writeFile(`.local-runtime/mail/${Date.now()}-${randomUUID()}.eml`,raw);console.log('Email lokal diterima di .local-runtime/mail (tidak dikirim ke internet).');callback();})().catch(callback);});}});
server.listen(1025,'127.0.0.1',()=>console.log('SMTP lokal siap pada 127.0.0.1:1025. Hanya untuk development.'));
