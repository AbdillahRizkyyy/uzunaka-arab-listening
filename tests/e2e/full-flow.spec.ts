import { test,expect,Page } from '@playwright/test';
test.skip(process.env.E2E_FULL!=='true','Requires isolated istima_test fixture server.');
async function answer(page:Page,correct=true){
 const play=page.getByRole('button',{name:'Putar audio',exact:true});await expect(play).toBeEnabled({timeout:10000});await play.click();
 const heading=await page.locator('h1.quiz-prompt,h2.quiz-prompt').innerText();
 const send=page.getByRole('button',{name:'Kirim jawaban',exact:true});
 if(heading.includes('dikte')){await expect(page.locator('textarea[lang="ar"]')).toBeEnabled();await page.locator('textarea[lang="ar"]').fill(correct?'أَنا.':'خطأ');}
 else if(heading.includes('urutkan')){const tokens=page.locator('.tokens').nth(1);await expect(tokens.getByRole('button').first()).toBeEnabled();await tokens.getByRole('button',{name:correct?'أنا':'هنا',exact:true}).click();await tokens.getByRole('button').click();}
 else {const option=page.locator('.option').filter({has:page.locator('span[lang="ar"]',{hasText:correct?'أ':'ب'})});await expect(option).toBeEnabled();await option.click();}
 await expect(send).toBeEnabled();await send.click();
}
test('onboarding → practice with all renderers → level-up → live and reconnect',async({page,browser},info)=>{
 test.setTimeout(240000);
 await page.goto('/akun');await page.getByLabel('Email',{exact:true}).fill(`${info.project.name}@e2e.example.invalid`);await page.getByLabel('Password',{exact:true}).fill('E2e-only-listening-2026');await page.getByRole('button',{name:'Masuk',exact:true}).last().click();await expect(page.getByRole('heading',{name:`Ahlan, E2E.`})).toBeVisible({timeout:20000});
 await page.getByRole('button',{name:'Mulai tes penempatan'}).click();
 for(let i=0;i<15;i++){await answer(page,false);await expect(page.getByText('Jawaban tersimpan.',{exact:true})).toBeVisible();await expect(page.getByText('Lihat teks Arab')).toHaveCount(0);await page.getByRole('button',{name:i===14?'Lihat hasil':'Soal berikutnya',exact:true}).click();}
 await expect(page.getByText(/Mulai dari level 1/)).toBeVisible();await page.getByRole('link',{name:'Kembali ke materi',exact:true}).click();
 await page.getByRole('button',{name:/Jumlah Murakkabah/}).click();await page.getByRole('button',{name:'Latihan',exact:true}).click();
 for(let i=0;i<5;i++){await answer(page);await expect(page.getByText('Tepat, Anda menangkap maknanya.')).toBeVisible();await page.getByRole('button',{name:i===4?'Lihat hasil':'Soal berikutnya',exact:true}).click();}
 await page.getByRole('link',{name:'Kembali ke materi',exact:true}).click();await page.getByRole('button',{name:/Jumlah Murakkabah/}).click();await page.getByRole('button',{name:'Ikuti tes naik level'}).click();
 for(let i=0;i<10;i++){await answer(page);await page.getByRole('button',{name:i===9?'Lihat hasil':'Soal berikutnya',exact:true}).click();}
 await expect(page.getByRole('heading',{name:'Level baru terbuka.'})).toBeVisible();
 await page.goto('/live');await page.getByLabel('Paket soal').selectOption('e2e-unit-1');await page.getByRole('button',{name:'Buat ruang'}).click();await expect(page).toHaveURL(/\/live\/[A-Z2-9]{6}/,{timeout:10000});await expect(page.locator('.code')).toBeVisible({timeout:20000});const code=(await page.locator('.code').innerText()).trim();
 const guestContext=await browser.newContext();const guest=await guestContext.newPage();await guest.goto(`${process.env.E2E_URL}/live?code=${code}`);await guest.getByLabel('Nama tampilan').fill('Guest E2E');await guest.getByRole('button',{name:'Gabung ruang'}).click();await guest.getByRole('button',{name:'Tes audio saya'}).click();await guest.getByRole('button',{name:'Suara terdengar, saya siap'}).click();await page.getByRole('button',{name:'Mulai audio check'}).click();await page.getByRole('button',{name:'Mulai kuis',exact:true}).click();
 for(let i=0;i<5;i++){await answer(guest);await expect(guest.getByText('Tepat, Anda menangkap maknanya.')).toBeVisible({timeout:10000});if(i===0){await guest.reload();await expect(guest.getByText('Tepat, Anda menangkap maknanya.')).toBeVisible();}await page.getByRole('button',{name:'Lihat leaderboard'}).click();await page.getByRole('button',{name:i===4?'Selesaikan sesi':'Soal berikutnya',exact:true}).click();}
 await expect(page.getByRole('heading',{name:'Sesi selesai.'})).toBeVisible();await expect(guest.getByRole('heading',{name:'Sesi selesai.'})).toBeVisible({timeout:10000});await guestContext.close();
});
