// main.js - Core do Jogo, Renderização e Interações de Combate Avançadas

// Cache de elementos UI
const UI = {
    healthFill: null,
    healthText: null,
    appleContainer: null,
    appleFill: null,
    shieldChargesContainer: null,
    absorbContainer: null,
    absorbFill: null
};

// Inicializa referências após carregar o DOM
window.addEventListener('DOMContentLoaded', () => {
    UI.healthFill = document.getElementById('health-bar-fill');
    UI.healthText = document.getElementById('health-text');
    UI.appleContainer = document.getElementById('apple-container');
    UI.appleFill = document.getElementById('apple-bar-fill');
    UI.shieldChargesContainer = document.getElementById('shield-charges');
    UI.absorbContainer = document.getElementById('absorb-bar-container');
    UI.absorbFill = document.getElementById('absorb-bar-fill');
});

// ==========================================
// EXPLOSÃO DO CRISTAL
// ==========================================
function explodeCrystal(c) {
    addFloatingText('💥 BOOM!', c.x, c.y, '#ff9f43');
    
    // Calcula Dano no Inimigo
    const distE = Math.hypot(enemy.x - c.x, enemy.y - c.y);
    if (distE < 150) {
        // HITKILL: Se inimigo estiver no ar e baixo (entre 0 e 80 de altura)
        if (enemy.z > 0 && enemy.z < 80) {
            applyDamageToEnemy(60);
            addFloatingText('HITKILL!', enemy.x, enemy.y, '#e74c3c');
        } else {
            if (enemy.isBlocking && enemy.shieldCharges > 0) {
                enemy.shieldCharges -= 1;
                addFloatingText('Defesa!', enemy.x, enemy.y - 30, '#3498db');
            } else {
                const d = applyDamageToEnemy(15);
                addFloatingText('-'+d, enemy.x, enemy.y, '#e74c3c');
                enemy.vz = 350;
            }
        }
    }
    
    // Calcula Dano no Player
    const distP = Math.hypot(player.x - c.x, player.y - c.y);
    if (distP < 150) {
        if (player.z > 0 && player.z < 80) {
            applyDamageToPlayer(60);
            addFloatingText('HITKILL!', player.x, player.y, '#e74c3c');
        } else {
            if (player.isBlocking && player.shieldCharges > 0) {
                player.shieldCharges--;
                addFloatingText('Defesa!', player.x, player.y - 30, '#3498db');
            } else {
                const d = applyDamageToPlayer(15);
                addFloatingText('-'+d, player.x, player.y, '#e74c3c');
                player.vz = 350;
            }
        }
        checkPlayerDeath();
    }

    // Remove o Cristal
    const idx = mapObjects.indexOf(c);
    if (idx > -1) mapObjects.splice(idx, 1);
}

function checkWin() {
    if (enemy.hp <= 0) {
        enemy.hp = 0;
        gameState = 'GAMEOVER';
        document.getElementById('end-title').innerText = 'VITÓRIA!';
        document.getElementById('end-title').style.color = '#f1c40f';
        document.getElementById('game-over-screen').style.display = 'flex';
    }
}

// ==========================================
// LÓGICA DE COMBATE E ITENS DO JOGADOR
// ==========================================
function handlePlayerCombat(dt) {
    // Diminui Cooldowns
    for (let k in player.cooldowns) {
        if (player.cooldowns[k] > 0) player.cooldowns[k] -= dt;
    }
    if (player.attackTimer > 0) player.attackTimer -= dt;

    player.isBlocking = false;
    let currentlyEating = false;

    // Mapeamento de Teclas para Slots da Hotbar (Sincronizado com globals.js)
    const hotbarKeys = {
        'KeyU': 0, // Maçã Dourada
        'KeyJ': 1, // Espada
        'KeyK': 2, // Carga de Vento
        'KeyL': 3, // Escudo
        'KeyO': 4, // Obsidian
        'KeyI': 5, // Maça de Ferro
        'KeyM': 6, // (Vazio)
        'KeyN': 7, // Cristal
        'KeyH': 8  // (Vazio)
    };

    // Verifica cada tecla de ação
    for (const [keyCode, slotIndex] of Object.entries(hotbarKeys)) {
        if (!keys[keyCode]) continue;
        
        const item = hotbar[slotIndex];
        if (!item) continue;

        // 1. ESPADA
        if (item.id === 'sword' && player.cooldowns.sword <= 0) {
            player.cooldowns.sword = 0.6;
            player.attackTimer = 0.15;
            player.currentWeapon = 'sword';
            const hx = player.x + player.dirX * 50;
            const hy = player.y + player.dirY * 50;
            if (Math.hypot(enemy.x - hx, enemy.y - hy) < 60) {
                if (Math.abs(player.z - enemy.z) > 40) addFloatingText('Errou!', enemy.x, enemy.y, '#bdc3c7');
                else if (enemy.isBlocking && enemy.shieldCharges > 0) {
                    enemy.shieldCharges -= 1;
                    addFloatingText('Defesa!', enemy.x, enemy.y - 30, '#3498db');
                } else {
                    const d = applyDamageToEnemy(4);
                    addFloatingText('-'+d, enemy.x, enemy.y, '#fff');
                }
            }
            mapObjects.forEach(o => { if (o.type === 'crystal' && Math.hypot(o.x - hx, o.y - hy) < 50) explodeCrystal(o); });
        }
        // 2. MAÇA DE FERRO
        else if (item.id === 'iron_mace' && player.cooldowns.mace <= 0) {
            player.cooldowns.mace = 1.0;
            player.attackTimer = 0.25;
            player.currentWeapon = 'mace';
            const isFalling = (player.z > 0 && player.vz < 0);
            const isDive = isFalling && player.isGliding;
            const isCrit = isFalling && !enemy.isBlocking && !player.isGliding;
            
            const hx = player.x + player.dirX * 55;
            const hy = player.y + player.dirY * 55;
            
            if (isDive) addFloatingText('MAÇA DIVE! 🔨🪽', player.x, player.y, '#f1c40f');
            else addFloatingText(isCrit ? 'MARRETADA!' : 'bonk', player.x, player.y, isCrit ? '#e74c3c' : '#bdc3c7');

            if (Math.hypot(enemy.x - hx, enemy.y - hy) < 70) {
                if (enemy.isBlocking && enemy.shieldCharges > 0) {
                    const breakAmt = isDive ? 3 : (isCrit ? 2 : 1);
                    enemy.shieldCharges -= breakAmt;
                    addFloatingText(`Escudo -${breakAmt}!`, enemy.x, enemy.y - 30, '#3498db');
                    
                    if (isDive) {
                        const d = applyDamageToEnemy(16);
                        addFloatingText('-'+d, enemy.x, enemy.y, '#e74c3c');
                        checkWin();
                    }
                } else {
                    let dmg = isDive ? 16 : (isCrit ? 10 : 2);
                    const d = applyDamageToEnemy(dmg);
                    addFloatingText('-' + d + (isCrit ? ' CRIT!' : (isDive ? ' DIVE!' : '')), enemy.x, enemy.y, (isCrit || isDive) ? '#e74c3c' : '#fff');
                    checkWin();
                }
            }
            mapObjects.forEach(o => { if (o.type === 'crystal' && Math.hypot(o.x - hx, o.y - hy) < 60) explodeCrystal(o); });
        }
        // 3. CARGA DE VENTO
        else if (item.id === 'wind_charge' && player.cooldowns.wind <= 0) {
            player.cooldowns.wind = 2.0;
            player.vz = 550;
            addFloatingText('Carga de Vento!', player.x, player.y, '#3498db');
            if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 120) enemy.vz = 550;
        }
        // 4. OBSIDIAN
        else if (item.id === 'obsidian' && player.cooldowns.obsidian <= 0) {
            player.cooldowns.obsidian = 1.0;
            const px = player.x + player.dirX * 60;
            const py = player.y + player.dirY * 60;
            mapObjects.push({ type: 'obsidian', x: px, y: py, width: 40, height: 40 });
        }
        // 5. CRISTAL
        else if (item.id === 'crystal' && player.cooldowns.crystal <= 0) {
            player.cooldowns.crystal = 0.2;
            const px = player.x + player.dirX * 60;
            const py = player.y + player.dirY * 60;
            const obs = mapObjects.find(o => o.type === 'obsidian' && Math.hypot(o.x - px, o.y - py) < 50);
            if (obs) {
                const crys = mapObjects.find(o => o.type === 'crystal' && Math.hypot(o.x - obs.x, o.y - obs.y) < 10);
                if (crys) explodeCrystal(crys);
                else mapObjects.push({ type: 'crystal', x: obs.x, y: obs.y, width: 30, height: 40 });
            } else {
                const crys = mapObjects.find(o => o.type === 'crystal' && Math.hypot(o.x - px, o.y - py) < 50);
                if (crys) explodeCrystal(crys);
            }
        }
        // 6. ESCUDO
        else if (item.id === 'shield') {
            if (keys[keyCode] || keys['ShiftLeft']) {
                player.isBlocking = true;
            }
        }
        // 7. MAÇÃ DOURADA
        else if (item.id === 'apple' && !player.isBlocking) {
            if (player.hp < player.maxHp) currentlyEating = true;
        }
        // 8. ENDER PEARL
        else if (item.id === 'ender_pearl' && player.cooldowns.pearl <= 0) {
            player.cooldowns.pearl = 3.0;
            projectiles.push({ 
                type: 'pearl', 
                owner: 'player', 
                x: player.x, 
                y: player.y, 
                dx: player.dirX, 
                dy: player.dirY, 
                speed: 600, 
                life: 2.0 
            });
            addFloatingText('🟣 Pearl!', player.x, player.y, '#9b59b6');
        }
        // 9. FOGOS DE ARTIFÍCIO
        else if (item.id === 'firework' && player.cooldowns.firework <= 0) {
            player.cooldowns.firework = 4.0;
            
            // Boost de Elytra
            if (player.isGliding) {
                const boost = 700; // Boost maior
                player.vx = player.dirX * boost;
                player.vy = player.dirY * boost;
                player.vz += 350; // Sobe mais
                item.dur--; // Consome durabilidade do fogo

                // Consome 1 de durabilidade da Elytra ao usar fogo de artifício
                if (player.armor.chestplate && player.armor.chestplate.id === 'elytra') {
                    player.armor.chestplate.dur--;
                    if (player.armor.chestplate.dur <= 0) {
                        player.armor.chestplate = null;
                        player.isGliding = false;
                        addFloatingText('🪽 Elytra Quebrou!', player.x, player.y, '#e74c3c');
                    }
                }

                addFloatingText('🚀 BOOST!', player.x, player.y, '#f1c40f');
                window.renderInventoryUI();
                return;
            }

            const fx = player.x + player.dirX * 80;
            const fy = player.y + player.dirY * 80;
            addFloatingText('🎆 BOOM!', fx, fy, '#f39c12');
            if (Math.hypot(enemy.x - fx, enemy.y - fy) < 100) {
                if (enemy.isBlocking && enemy.shieldCharges > 0) {
                    enemy.shieldCharges -= 2;
                    addFloatingText('Defesa!', enemy.x, enemy.y - 30, '#3498db');
                } else {
                    const d = applyDamageToEnemy(8);
                    addFloatingText('-'+d, enemy.x, enemy.y, '#e74c3c');
                    enemy.vz = 300;
                }
            }
        }
        // 10. TRIDENT
        else if (item.id === 'trident' && player.cooldowns.attack <= 0) {
            player.cooldowns.attack = 0.8;
            player.attackTimer = 0.2;
            player.currentWeapon = 'trident';
            const hx = player.x + player.dirX * 85;
            const hy = player.y + player.dirY * 85;
            if (Math.hypot(enemy.x - hx, enemy.y - hy) < 75) {
                if (Math.abs(player.z - enemy.z) > 40) addFloatingText('Errou!', enemy.x, enemy.y, '#bdc3c7');
                else if (enemy.isBlocking && enemy.shieldCharges > 0) {
                    enemy.shieldCharges -= 1;
                    addFloatingText('Defesa!', enemy.x, enemy.y - 30, '#3498db');
                } else {
                    const d = applyDamageToEnemy(3);
                    addFloatingText('-'+d+' 🔱', enemy.x, enemy.y, '#1abc9c');
                }
            }
        }
    }

    if (currentlyEating) {
        player.isEating = true;
        player.appleTimer += dt;
        if (player.appleTimer >= 4.0) {
            player.hp = Math.min(player.maxHp, player.hp + 10);
            player.appleTimer = 0;
            addFloatingText('+10 HP', player.x, player.y, '#2ecc71');
        }
    } else {
        player.isEating = false;
        player.appleTimer = 0;
    }
}

// ==========================================
// RENDERING E UI
// ==========================================
function updateFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        ft.y -= 50 * dt; 
        ft.alpha -= dt;  
        if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }
}

function updateMainUI() {
    const hpPercent = (player.hp / player.maxHp) * 100;
    
    if (UI.healthFill) UI.healthFill.style.width = hpPercent + '%';
    
    if (player.absorb > 0) {
        if (UI.absorbContainer) UI.absorbContainer.style.opacity = '1';
        if (UI.absorbFill) UI.absorbFill.style.width = (Math.min(1, player.absorb / 10) * 100) + '%';
        if (UI.healthFill) UI.healthFill.style.boxShadow = '0 0 12px #f1c40f';
    } else {
        if (UI.absorbContainer) UI.absorbContainer.style.opacity = '0';
        if (UI.healthFill) UI.healthFill.style.boxShadow = 'none';
    }

    if (UI.healthText) UI.healthText.innerText = `${Math.ceil(player.hp)}${player.absorb > 0 ? ' + ' + Math.ceil(player.absorb) : ''} / ${player.maxHp}`;

    if (player.isEating) {
        UI.appleContainer.style.display = 'block';
        UI.appleFill.style.width = ((player.appleTimer / 4.0) * 100) + '%';
    } else {
        UI.appleContainer.style.display = 'none';
        UI.appleFill.style.width = '0%';
    }

    // Atualiza UI dos escudos
    UI.shieldChargesContainer.innerHTML = '';
    for (let i = 0; i < player.shieldCharges; i++) {
        UI.shieldChargesContainer.innerHTML += '<div style="font-size: 20px;">🛡️</div>';
    }
    if (player.shieldCharges < 5) {
        // Mostra o progresso do proximo shield
        const progress = (player.shieldTimer / 7.0) * 100;
        UI.shieldChargesContainer.innerHTML += `<div style="font-size: 20px; opacity: 0.5; position: relative;">
            🛡️<div style="position: absolute; bottom: 0; left: 0; width: 100%; height: ${progress}%; background: rgba(52, 152, 219, 0.4);"></div>
        </div>`;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Câmera Centralizada
    let camX = Math.max(0, Math.min(MAP_WIDTH - canvas.width, player.x - canvas.width / 2));
    let camY = Math.max(0, Math.min(MAP_HEIGHT - canvas.height, player.y - canvas.height / 2));

    ctx.save();
    ctx.translate(-camX, -camY);

    // Chão de Arena
    ctx.fillStyle = '#2d3436'; 
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; 
    ctx.lineWidth = 2;
    for(let i=0; i<MAP_WIDTH; i+=100) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_HEIGHT); ctx.stroke(); }
    for(let j=0; j<MAP_HEIGHT; j+=100) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(MAP_WIDTH, j); ctx.stroke(); }

    // Desenha Blocos e Cristais
    mapObjects.forEach(o => {
        if (o.type === 'obsidian') {
            ctx.fillStyle = '#1e1026'; ctx.fillRect(o.x - o.width/2, o.y - o.height/2, o.width, o.height);
            ctx.fillStyle = '#3a1f4a'; ctx.fillRect(o.x - o.width/4, o.y - o.height/4, o.width/2, o.height/2);
            // Borda de colisão visual
            ctx.strokeStyle = '#6c3483'; ctx.lineWidth = 2;
            ctx.strokeRect(o.x - o.width/2, o.y - o.height/2, o.width, o.height);
        } else if (o.type === 'crystal') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath(); ctx.arc(o.x, o.y, 25 + Math.sin(performance.now()/150)*5, 0, Math.PI*2); ctx.fill();
            
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.moveTo(o.x, o.y - 20); ctx.lineTo(o.x + 12, o.y); ctx.lineTo(o.x, o.y + 20); ctx.lineTo(o.x - 12, o.y); ctx.fill();
        }
    });

    // Sombras (Base da posição real)
    [player, enemy].forEach(e => {
        if (e.hp > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.ellipse(e.x, e.y, e.width/2, e.height/4, 0, 0, Math.PI*2); ctx.fill();
        }
    });

    // Ordenação Y Visual (Usando a posição Y real para ordenar)
    const entities = [];
    if (player.hp > 0) entities.push({ type: 'player', e: player });
    if (enemy.hp > 0) entities.push({ type: 'enemy', e: enemy });
    entities.sort((a, b) => a.e.y - b.e.y);

    entities.forEach(item => {
        const e = item.e;
        const drawY = e.y - e.z; // Aplica o Z-axis subindo a renderização

        ctx.save();
        ctx.translate(e.x, drawY);
        
        // Aura Maçã Dourada (Player e Inimigo)
        if (e.isEating) {
            ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
            ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill();
            // Barra de progresso da maçã acima da cabeça
            const eatDuration = item.type === 'enemy' ? 8.0 : 4.0;
            const eatProgress = e.appleTimer / eatDuration;
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(-20, -45, 40, 6);
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(-20, -45, 40 * eatProgress, 6);
            // Ícone de maçã
            ctx.font = '14px Arial'; ctx.textAlign = 'center';
            ctx.fillText('🍎', 0, -50);
        }

        // Corpo Principal
        ctx.fillStyle = e.color; 
        ctx.fillRect(-e.width/2, -e.height/2, e.width, e.height);
        
        // Direção Visual
        const angle = Math.atan2(e.dirY, e.dirX);
        ctx.save(); ctx.rotate(angle);
        ctx.fillStyle = '#fff'; ctx.fillRect(8, -8, 6, 6); ctx.fillRect(8, 2, 6, 6);
        ctx.restore();

        // Armas / Ataques
        if (e.attackTimer > 0) {
            ctx.save(); ctx.rotate(angle);
            if (e.currentWeapon === 'mace') {
                ctx.fillStyle = 'rgba(149, 165, 166, 0.9)';
                ctx.beginPath(); ctx.arc(0, 0, 65, -Math.PI/2.2, Math.PI/2.2); ctx.lineTo(0,0); ctx.fill();
            } else if (e.currentWeapon === 'trident') {
                // Visual da Lança: Mais estreito e mais para frente
                ctx.fillStyle = '#1abc9c';
                ctx.fillRect(15, -4, 55, 8); // Haste
                ctx.beginPath();
                ctx.moveTo(70, -10); ctx.lineTo(90, 0); ctx.lineTo(70, 10); ctx.fill(); // Ponta
            } else {
                ctx.fillStyle = item.type === 'enemy' ? 'rgba(231, 76, 60, 0.8)' : 'rgba(236, 240, 241, 0.9)';
                ctx.beginPath(); ctx.arc(0, 0, 55, -Math.PI/3, Math.PI/3); ctx.lineTo(0,0); ctx.fill();
            }
            ctx.restore();
        }

        // Escudo
        if (e.isBlocking) {
            ctx.save(); ctx.rotate(angle);
            ctx.strokeStyle = '#3498db'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI/2.5, Math.PI/2.5); ctx.stroke();
            ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)'; ctx.lineWidth = 15;
            ctx.beginPath(); ctx.arc(0, 0, 25, -Math.PI/2.5, Math.PI/2.5); ctx.stroke();
            ctx.restore();
        }

        // Barra de Vida Inimigo
        if (item.type === 'enemy') {
            const barY = e.isEating ? -55 : -35;
            const hpPercent = e.hp / e.maxHp;
            const absPercent = e.absorb / 20; // Normaliza absorção (max 20 para visual)
            
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-20, barY, 40, 5);
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(-20, barY, 40 * hpPercent, 5);
            
            if (e.absorb > 0) {
                ctx.fillStyle = '#f1c40f'; // Dourado para absorção
                ctx.fillRect(-20, barY - 2, 40 * Math.min(1, e.absorb/10), 2);
            }
            
            // Cargas de escudo do inimigo
            if (e.shieldCharges > 0) {
                ctx.font = '10px Arial'; ctx.textAlign = 'center';
                ctx.fillStyle = '#3498db';
                ctx.fillText('🛡️'.repeat(Math.min(e.shieldCharges, 5)), 0, barY - 5);
            }
        }

        ctx.restore();
    });

    // Projéteis (Ender Pearls etc.)
    projectiles.forEach(p => {
        ctx.fillStyle = p.type === 'pearl' ? '#9b59b6' : '#f39c12';
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // Textos Flutuantes (Sempre por cima)
    floatingTexts.forEach(ft => {
        ctx.save(); ctx.globalAlpha = ft.alpha; ctx.fillStyle = ft.color;
        ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    });

    ctx.restore();
}



// ==========================================
// LÓGICA DE INVENTÁRIO (UI MINECRAFT-STYLE)
// ==========================================
let draggingItem = null;
let draggingSource = null;

window.toggleInventory = function() {
    if (gameState === 'PLAYING') {
        gameState = 'INVENTORY';
        document.getElementById('inventory-screen').style.display = 'flex';
        window.renderInventoryUI();
    } else if (gameState === 'INVENTORY') {
        gameState = 'PLAYING';
        document.getElementById('inventory-screen').style.display = 'none';
        lastTime = performance.now();
    }
}

window.renderInventoryUI = function() {
    const invGrid = document.getElementById('mc-inv-grid');
    const hotGrid = document.getElementById('mc-hotbar-grid');
    
    // Renderiza Inventário Principal
    invGrid.innerHTML = '';
    for(let i=0; i<27; i++) {
        invGrid.appendChild(createSlotElement(inventory, i));
    }
    
    // Renderiza Hotbar
    hotGrid.innerHTML = '';
    const hotbarLabels = ['U', 'J', 'K', 'L', 'O', 'I', 'M', 'N', 'H'];
    for(let i=0; i<9; i++) {
        const slot = createSlotElement(hotbar, i);
        // Adiciona label da tecla no slot da hotbar
        const label = document.createElement('div');
        label.className = 'mc-slot-label';
        label.style.top = '2px'; label.style.left = '4px'; label.style.right = 'auto';
        label.innerText = hotbarLabels[i];
        slot.appendChild(label);
        hotGrid.appendChild(slot);
    }

    // Atualiza Armor Slots
    updateArmorSlots();
    
    // Atualiza Offhand
    updateOffhandSlot();

    // Totem Info
    document.getElementById('totem-info').innerText = `Totens Usados: ${totemsUsed}/${MAX_TOTEMS}`;
}

function createSlotElement(container, index) {
    const slot = document.createElement('div');
    slot.className = 'mc-slot' + (container[index] ? ' has-item' : '');
    
    const item = container[index];
    if(item) {
        const data = ItemData[item.id];
        slot.innerHTML = `<span>${data.icon}</span>`;
        
        // Barra de Durabilidade
        if(data.maxDur) {
            const perc = (item.dur / data.maxDur) * 100;
            const color = perc > 50 ? '#55ff55' : (perc > 20 ? '#ffff55' : '#ff5555');
            slot.innerHTML += `
                <div class="mc-dur-bar">
                    <div class="mc-dur-fill" style="width: ${perc}%; background: ${color}"></div>
                </div>`;
        }
        
        // Label (Quantidade ou algo do tipo)
        if(item.dur > 1 && !data.maxDur) {
            slot.innerHTML += `<div class="mc-slot-label">${item.dur}</div>`;
        }
    }
    
    slot.onclick = () => window.handleSlotClick(container, index);
    return slot;
}

window.handleSlotClick = function(container, index) {
    const item = container[index];
    
    if (!selectedInventoryItem) {
        if (item) {
            selectedInventoryItem = { container, index, item };
            window.renderInventoryUI();
        }
    } else {
        const source = selectedInventoryItem;
        const targetItem = container[index];
        
        // Verifica restrição de slot se for armadura
        if (container === player.armor) {
            const allowed = ItemData[source.item.id].slot;
            if (allowed !== index) {
                addFloatingText('🚫 Não cabe aqui!', player.x, player.y, '#e74c3c');
                return;
            }
        }
        if (index === 'offhand') {
            // Offhand aceita qualquer coisa (geralmente totem)
        }

        source.container[source.index] = targetItem;
        container[index] = source.item;
        
        selectedInventoryItem = null;
        window.renderInventoryUI();
    }
}

window.equipArmor = (slot) => window.handleSlotClick(player.armor, slot);
window.equipOffhand = () => window.handleSlotClick(player, 'offhand');

function updateArmorSlots() {
    const slots = ['helmet', 'chestplate', 'leggings', 'boots'];
    slots.forEach(s => {
        const el = document.getElementById(`armor-${s}`);
        const item = player.armor[s];
        el.innerHTML = '';
        el.className = 'mc-slot mc-armor-slot' + (item ? ' has-item' : '');
        if(selectedInventoryItem && selectedInventoryItem.container === player.armor && selectedInventoryItem.index === s) {
            el.style.border = '2px solid #fff';
        } else el.style.border = 'none';

        if(item) {
            const data = ItemData[item.id];
            el.innerHTML = `<span>${data.icon}</span>`;
            const perc = (item.dur / data.maxDur) * 100;
            const color = perc > 50 ? '#55ff55' : (perc > 20 ? '#ffff55' : '#ff5555');
            el.innerHTML += `<div class="mc-dur-bar"><div class="mc-dur-fill" style="width: ${perc}%; background: ${color}"></div></div>`;
        }
    });
}

function updateOffhandSlot() {
    const el = document.getElementById('offhand-slot');
    const item = player.offhand;
    el.innerHTML = '';
    el.className = 'mc-slot mc-offhand-slot' + (item ? ' has-item' : '');
    if(item) {
        const data = ItemData[item.id];
        el.innerHTML = `<span>${data.icon}</span>`;
    }
}

window.equipArmor = function(slotType) {
    if(selectedInventoryItem && ItemData[selectedInventoryItem.item.id].slot === slotType) {
        const oldArmor = player.armor[slotType];
        player.armor[slotType] = selectedInventoryItem.item;
        selectedInventoryItem.container[selectedInventoryItem.index] = oldArmor;
        selectedInventoryItem = null;
        window.renderInventoryUI();
    } else if(!selectedInventoryItem && player.armor[slotType]) {
        // Desequipar
        const armor = player.armor[slotType];
        // Tenta colocar no inventário livre
        for(let i=0; i<27; i++) {
            if(!inventory[i]) {
                inventory[i] = armor;
                player.armor[slotType] = null;
                break;
            }
        }
        window.renderInventoryUI();
    }
}

window.equipOffhand = function() {
    if(selectedInventoryItem && selectedInventoryItem.item.id === 'totem') {
        const oldOff = player.offhand;
        player.offhand = selectedInventoryItem.item;
        selectedInventoryItem.container[selectedInventoryItem.index] = oldOff;
        selectedInventoryItem = null;
        window.renderInventoryUI();
    } else if(!selectedInventoryItem && player.offhand) {
        const item = player.offhand;
        for(let i=0; i<27; i++) {
            if(!inventory[i]) {
                inventory[i] = item;
                player.offhand = null;
                break;
            }
        }
        window.renderInventoryUI();
    }
}

// ==========================================
// LÓGICA DO MENU INICIAL
// ==========================================
window.renderMenuUI = function() {
    const menuGrid = document.getElementById('menu-hotbar-grid');
    const controlsList = document.getElementById('menu-controls-list');
    const hotbarKeys = ['U', 'J', 'K', 'L', 'O', 'I', 'M', 'N', 'H'];

    // Renderiza Hotbar no Menu
    menuGrid.innerHTML = '';
    hotbar.forEach((item, i) => {
        const slot = createSlotElement(hotbar, i);
        // Adiciona label da tecla
        const label = document.createElement('div');
        label.className = 'mc-slot-label';
        label.style.top = '2px'; label.style.left = '4px'; label.style.right = 'auto';
        label.innerText = hotbarKeys[i];
        slot.appendChild(label);
        
        // No menu, clicar no slot muda o item (cicla entre os principais)
        slot.onclick = () => {
            const ids = Object.keys(ItemData).filter(id => !id.includes('neth_'));
            let currIdx = ids.indexOf(item ? item.id : '');
            let nextIdx = (currIdx + 1) % ids.length;
            hotbar[i] = { id: ids[nextIdx], dur: ItemData[ids[nextIdx]].maxDur || 64 };
            window.renderMenuUI();
        };
        menuGrid.appendChild(slot);
    });

    window.updateControlsUI = function() {
        controlsList.innerHTML = `
            <p><span>WASD</span> Mover Personagem</p>
            <p><span>E/TAB</span> Abrir Inventário (Jogo)</p>
            <p><span>M</span> Picareta (Quebrar Blocos)</p>
            <p style="margin-top:10px; border-top:1px solid #333; padding-top:5px; color:#f1c40f;">Habilidades Atuais:</p>
        `;
        const hotbarLabels = ['U', 'J', 'K', 'L', 'O', 'I', 'M', 'N', 'H'];
        hotbar.forEach((item, i) => {
            if (item) {
                const data = ItemData[item.id];
                controlsList.innerHTML += `<p><span>${hotbarLabels[i]}</span> ${data.icon} ${data.name}</p>`;
            }
        });
    }
    window.updateControlsUI();
}

window.goToMenu = function() {
    gameState = 'MENU';
    document.getElementById('menu-screen').style.display = 'flex';
    document.getElementById('game-wrapper').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    window.renderMenuUI();
}

window.toggleMenuControls = function() {
    const main = document.getElementById('menu-main-col');
    const controls = document.getElementById('menu-controls-col');
    if (controls.style.display === 'none') {
        main.style.display = 'none';
        controls.style.display = 'flex';
    } else {
        main.style.display = 'flex';
        controls.style.display = 'none';
    }
}

// Inicializa o Menu ao carregar
window.onload = () => {
    window.renderMenuUI();
};

// ==========================================
// LOOP E GERENCIAMENTO
// ==========================================
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyU', 'KeyJ', 'KeyK', 'KeyL', 'KeyO', 'KeyI', 'KeyM', 'KeyE', 'Tab', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
    if (e.code === 'KeyE' || e.code === 'Tab') window.toggleInventory();
});
window.addEventListener('keyup', e => keys[e.code] = false);

window.startGame = function() {
    currentDifficulty = document.getElementById('diff-select').value;
    
    // Configura a dificuldade inicial
    if (currentDifficulty === 'dummy') {
        enemy.maxHp = 60; enemy.speed = 0; // Dummy: parado, HP normal
    } else if (currentDifficulty === 'easy') {
        enemy.maxHp = 40; enemy.speed = 120;
    } else if (currentDifficulty === 'hard') {
        enemy.maxHp = 80; enemy.speed = 190;
    } else {
        enemy.maxHp = 60; enemy.speed = 155;
    }

    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'block';
    window.restartGame();
}

window.restartGame = function() {
    player.hp = player.maxHp; player.x = 400; player.y = 400; player.z = 0; player.vz = 0;
    player.cooldowns = { attack:0, sword:0, mace:0, wind:0, obsidian:0, crystal:0, pickaxe:0, pearl:0, firework:0 };
    player.shieldCharges = 5; player.shieldTimer = 0;
    player.isMining = false;
    
    enemy.hp = enemy.maxHp; enemy.x = 800; enemy.y = 400; enemy.z = 0; enemy.vz = 0;
    enemy.shieldCharges = 5; enemy.shieldTimer = 0;
    enemy.isEating = false; enemy.appleTimer = 0; enemy.hasUsedApple = false;
    enemy.cooldowns = { sword: 0, decision: 0 };
    
    mapObjects.length = 0;
    floatingTexts.length = 0;
    
    gameState = 'PLAYING';
    document.getElementById('game-over-screen').style.display = 'none';
    window.updateControlsUI();
    
    lastTime = performance.now();
    if (!loopRunning) {
        loopRunning = true;
        requestAnimationFrame(gameLoop);
    }
}

function gameLoop(time) {
    let dt = (time - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; 
    lastTime = time;

    if (gameState === 'PLAYING' || gameState === 'INVENTORY') {
        updatePhysics(dt);
        updateProjectiles(dt); // FALTAVA ISSO PARA A PÉROLA FUNCIONAR!
        handlePlayerMovement(dt);
        updateEnemyAI(dt);
        
        // Só permite combate se não estiver no inventário
        if (gameState === 'PLAYING') handlePlayerCombat(dt);
        
        updateFloatingTexts(dt);
        updateMainUI();
        draw();
    } else if (gameState === 'GAMEOVER') {
        draw();
    }
    
    requestAnimationFrame(gameLoop);
}
