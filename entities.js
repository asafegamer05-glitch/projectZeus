// entities.js
function updatePhysics(dt){
    const grav=900,glideG=150;
    if(player.z>0||player.vz!==0){
        player.z+=player.vz*dt;
        // Ativa elytra automaticamente se estiver caindo e tiver equipada
        // Ativa elytra automaticamente se estiver caindo e tiver equipada e com durabilidade
        if(player.vz < -50 && player.armor.chestplate && player.armor.chestplate.id === 'elytra' && !player.isGliding) {
            if (player.armor.chestplate.dur > 0) {
                player.isGliding = true;
                player.armor.chestplate.dur--; // Gasta 1 ao começar a planar
                addFloatingText('🪽 Glide Start!', player.x, player.y, '#fff');
                if (player.armor.chestplate.dur <= 0) {
                    player.armor.chestplate = null;
                    player.isGliding = false;
                    addFloatingText('🪽 Elytra Quebrou!', player.x, player.y, '#e74c3c');
                }
            }
        }
        player.vz-=((player.isGliding)?glideG:grav)*dt;
        if(player.isGliding){
            player.x+=player.dirX*280*dt;player.y+=player.dirY*280*dt;
            player.vz = Math.max(player.vz, -150); 
        }
        if(player.z<=0){player.z=0;player.vz=0;player.isGliding=false;}
    } else player.isGliding=false;

    if(enemy.z>0||enemy.vz!==0){enemy.z+=enemy.vz*dt;enemy.vz-=grav*dt;if(enemy.z<=0){enemy.z=0;enemy.vz=0;}}

    if(player.shieldCharges<5){player.shieldTimer+=dt;if(player.shieldTimer>=7){player.shieldCharges++;player.shieldTimer=0;}}else player.shieldTimer=0;
    if(enemy.shieldCharges<5){enemy.shieldTimer+=dt;if(enemy.shieldTimer>=7){enemy.shieldCharges++;enemy.shieldTimer=0;}}else enemy.shieldTimer=0;
}

function updateProjectiles(dt){
    for(let i=projectiles.length-1;i>=0;i--){
        const p=projectiles[i];p.x+=p.dx*p.speed*dt;p.y+=p.dy*p.speed*dt;p.life-=dt;
        let tp=false;
        if(p.life<=0||p.x<0||p.x>MAP_WIDTH||p.y<0||p.y>MAP_HEIGHT) tp=true;
        if(!tp){for(const o of mapObjects){if(o.type==='obsidian'&&Math.hypot(o.x-p.x,o.y-p.y)<30){tp=true;break;}}}
        if(tp&&p.type==='pearl'){
            const target = p.owner === 'player' ? player : enemy;
            target.x=Math.max(20,Math.min(MAP_WIDTH-20,p.x));
            target.y=Math.max(20,Math.min(MAP_HEIGHT-20,p.y));
            
            if(p.owner === 'player') {
                const d=applyDamageToPlayer(3);
                addFloatingText('⟐ -'+d,player.x,player.y,'#9b59b6');
                checkPlayerDeath();
            } else {
                const d=applyDamageToEnemy(3);
                addFloatingText('⟐ -'+d,enemy.x,enemy.y,'#9b59b6');
            }
            projectiles.splice(i,1);
        } else if(tp){projectiles.splice(i,1);}
    }
}

function checkObsidianCollision(e,nx,ny){
    const hw=e.width/2,hh=e.height/2;
    for(const o of mapObjects){if(o.type!=='obsidian')continue;const ow=o.width/2,oh=o.height/2;
    if(nx+hw>o.x-ow&&nx-hw<o.x+ow&&ny+hh>o.y-oh&&ny-hh<o.y+oh)return true;}return false;
}
function moveWithCollision(e,dx,dy,sp,dt){
    const nx=e.x+dx*sp*dt,ny=e.y+dy*sp*dt;
    if(!checkObsidianCollision(e,nx,ny)){e.x=nx;e.y=ny;}
    else{if(!checkObsidianCollision(e,nx,e.y))e.x=nx;if(!checkObsidianCollision(e,e.x,ny))e.y=ny;}
}

function handlePlayerMovement(dt){
    let dx=0,dy=0;
    if(keys[keybinds.up])dy-=1;if(keys[keybinds.down])dy+=1;
    if(keys[keybinds.left])dx-=1;if(keys[keybinds.right])dx+=1;
    if(dx!==0||dy!==0){const l=Math.hypot(dx,dy);dx/=l;dy/=l;player.dirX=dx;player.dirY=dy;}
    moveWithCollision(player,dx,dy,player.speed,dt);
    player.x=Math.max(20,Math.min(MAP_WIDTH-20,player.x));
    player.y=Math.max(20,Math.min(MAP_HEIGHT-20,player.y));

    if(keys[keybinds.mine]){
        const has = hotbar.some(i => i && i.id === 'pickaxe') || inventory.some(i => i && i.id === 'pickaxe');
        if(has && player.cooldowns.pickaxe <= 0){
            player.cooldowns.pickaxe = 0.3;
            player.isMining = true;
            const hx = player.x + player.dirX * 55;
            const hy = player.y + player.dirY * 55;
            for(let i = mapObjects.length - 1; i >= 0; i--){
                const o = mapObjects[i];
                if(o.type === 'obsidian' && Math.hypot(o.x - hx, o.y - hy) < 50){
                    addFloatingText('⛏️ Quebrou!', o.x, o.y, '#95a5a6');
                    mapObjects.splice(i, 1);
                    break;
                }
            }
        }
    } else player.isMining = false;
}

function updateEnemyAI(dt){
    if(enemy.hp<=0)return;
    if(currentDifficulty==='dummy'){enemy.isBlocking=false;enemy.isEating=false;enemy.state='idle';
        for(let k in enemy.cooldowns)if(enemy.cooldowns[k]>0)enemy.cooldowns[k]-=dt;
        if(enemy.attackTimer>0)enemy.attackTimer-=dt;return;}

    for(let k in enemy.cooldowns)if(enemy.cooldowns[k]>0)enemy.cooldowns[k]-=dt;
    if(enemy.attackTimer>0)enemy.attackTimer-=dt;
    const dist=Math.hypot(player.x-enemy.x,player.y-enemy.y),inM=dist<75;

    // Lógica de Maçã Dourada (Para todos os NPCs agora)
    const lowHp = enemy.hp < enemy.maxHp * 0.6;
    if(lowHp && !enemy.hasUsedApple && !enemy.isEating && Math.random() < 0.1){
        enemy.isEating = true; enemy.appleTimer = 0;
        addFloatingText('🍎 Comendo...', enemy.x, enemy.y, '#f1c40f');
        return;
    }

    if(enemy.isEating){
        enemy.appleTimer+=dt;
        // NPC foge enquanto come em qualquer dificuldade
        let moveDir = -1; // -1 = foge
        
        const sa=Math.atan2(player.y-enemy.y,player.x-enemy.x);
        enemy.dirX=Math.cos(sa) * moveDir; 
        enemy.dirY=Math.sin(sa) * moveDir;
        moveWithCollision(enemy,enemy.dirX,enemy.dirY,enemy.speed*0.8,dt);
        
        if(enemy.appleTimer>=8){
            enemy.hp=Math.min(enemy.maxHp,enemy.hp+15);
            enemy.isEating=false;enemy.appleTimer=0;
            enemy.hasUsedApple=true;addFloatingText('+15 HP 🍎',enemy.x,enemy.y,'#2ecc71');
        }
        return; 
    }

    // Lógica de Combos e Habilidades Especiais
    if(enemy.cooldowns.decision <= 0){
        enemy.cooldowns.decision = (currentDifficulty === 'hard' ? 0.3 : 0.6) + Math.random() * 0.4;
        if((currentDifficulty === 'hard' || currentDifficulty === 'normal') && dist < 150 && enemy.z === 0 && Math.random() < 0.3){
            enemy.vz = 500; enemy.currentWeapon = 'mace';
            addFloatingText('💨 WIND JUMP!', enemy.x, enemy.y, '#fff');
        }
        if(currentDifficulty === 'hard' && dist < 120 && Math.random() < 0.05){
            const ox = enemy.x + enemy.dirX*40, oy = enemy.y + enemy.dirY*40;
            const hasObs = mapObjects.some(o => o.type==='obsidian' && Math.hypot(o.x-ox, o.y-oy) < 30);
            if(!hasObs) mapObjects.push({type:'obsidian', x:ox, y:oy});
            setTimeout(() => {
                mapObjects.push({type:'crystal', x:ox, y:oy});
                addFloatingText('🔮 CRYSTAL!', enemy.x, enemy.y, '#9b59b6');
                setTimeout(() => {
                    const cry = mapObjects.find(o => o.type==='crystal' && Math.hypot(o.x-ox, o.y-oy) < 10);
                    if(cry && Math.hypot(player.x-cry.x, player.y-cry.y) < 100) if(typeof window.explodeCrystal === 'function') window.explodeCrystal(cry);
                }, 400);
            }, 300);
        }
        const r=Math.random();
        if(r<0.35)enemy.state='attack';else if(r<0.55)enemy.state='retreat';else if(r<0.75)enemy.state='block';else if(r<0.9)enemy.state='strafe';else enemy.state='chase';
        if(enemy.state==='strafe')enemy.strafeAngle=Math.random()>0.5?1:-1;
    }

    enemy.isBlocking = (enemy.state === 'block');

    if(!enemy.isBlocking && enemy.z === 0){
        let dx=0,dy=0; const a=Math.atan2(player.y-enemy.y,player.x-enemy.x);
        if(enemy.state==='chase'||enemy.state==='attack'){dx=Math.cos(a);dy=Math.sin(a);}
        else if(enemy.state==='retreat'){dx=-Math.cos(a);dy=-Math.sin(a);}
        else if(enemy.state==='strafe'){const sa=a+(Math.PI/2)*enemy.strafeAngle;dx=Math.cos(sa);dy=Math.sin(sa);if(dist>120){dx=(dx+Math.cos(a))*0.6;dy=(dy+Math.sin(a))*0.6;}}
        if(dx!==0||dy!==0){const l=Math.hypot(dx,dy);enemy.dirX=dx/l;enemy.dirY=dy/l;moveWithCollision(enemy,enemy.dirX,enemy.dirY,enemy.speed,dt);}
    }
    enemy.x=Math.max(20,Math.min(MAP_WIDTH-20,enemy.x));enemy.y=Math.max(20,Math.min(MAP_HEIGHT-20,enemy.y));

    if(inM && !enemy.isBlocking && (enemy.state==='attack'||enemy.state==='chase'||enemy.state==='strafe')){
        if(enemy.cooldowns.sword <= 0){
            if(enemy.z > 0 && enemy.vz < 0){
                enemy.cooldowns.sword = 1.2; enemy.attackTimer = 0.3; enemy.currentWeapon = 'mace';
                const d = applyDamageToPlayer(16); // Mace Dive 16
                addFloatingText('🔨 DIVE! -'+d, player.x, player.y, '#f1c40f');
                checkPlayerDeath();
            } else {
                const weaponRnd = Math.random();
                if(weaponRnd < 0.5){
                    enemy.cooldowns.sword = 0.8; enemy.attackTimer = 0.2; enemy.currentWeapon = 'sword';
                    if(Math.abs(player.z-enemy.z)>40) addFloatingText('Errou!',enemy.x,enemy.y,'#bdc3c7');
                    else if(player.isBlocking&&player.shieldCharges>0){player.shieldCharges--;addFloatingText('Defesa!',player.x,player.y-30,'#3498db');}
                    else{const d=applyDamageToPlayer(4);addFloatingText('-'+d,player.x,player.y,'#ff9f43');checkPlayerDeath();}
                } else if(weaponRnd < 0.8) {
                    enemy.cooldowns.sword = 1.0; enemy.attackTimer = 0.25; enemy.currentWeapon = 'trident';
                    if(Math.abs(player.z-enemy.z)>40) addFloatingText('Errou!',enemy.x,enemy.y,'#bdc3c7');
                    else if(player.isBlocking&&player.shieldCharges>0){player.shieldCharges--;addFloatingText('Defesa!',player.x,player.y-30,'#3498db');}
                    else{const d=applyDamageToPlayer(3);addFloatingText('-'+d+'🔱',player.x,player.y,'#1abc9c');checkPlayerDeath();}
                } else {
                    enemy.cooldowns.sword = 1.5; enemy.attackTimer = 0.3; enemy.currentWeapon = 'mace';
                    if(Math.abs(player.z-enemy.z)>40) addFloatingText('Errou!',enemy.x,enemy.y,'#bdc3c7');
                    else if(player.isBlocking&&player.shieldCharges>0){player.shieldCharges--;addFloatingText('Defesa!',player.x,player.y-30,'#3498db');}
                    else{const d=applyDamageToPlayer(10);addFloatingText('-'+d+'🔨',player.x,player.y,'#f1c40f');checkPlayerDeath();}
                }
            }
        }
    }

    if(!inM && dist < 450 && dist > 250 && enemy.hp > 15 && enemy.cooldowns.decision <= 0.1 && Math.random() < 0.02){
        projectiles.push({ type:'pearl', owner:'enemy', x:enemy.x, y:enemy.y, dx:(player.x-enemy.x)/dist, dy:(player.y-enemy.y)/dist, speed:600, life:2.0 });
        addFloatingText('🟣 Pearl!', enemy.x, enemy.y, '#9b59b6');
    }
}
