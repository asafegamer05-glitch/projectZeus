// globals.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;
let gameState = 'MENU';
let lastTime = 0;
let loopRunning = false;
let currentDifficulty = 'normal';
const keys = {};

const ItemData = {
    sword:       { icon: '🗡️', name: 'Espada' },
    iron_mace:   { icon: '🔨', name: 'Maça de Ferro' },
    trident:     { icon: '🔱', name: 'Lança' },
    shield:      { icon: '🛡️', name: 'Escudo' },
    apple:       { icon: '🍎', name: 'Maçã Dourada' },
    wind_charge: { icon: '💨', name: 'Carga de Vento' },
    obsidian:    { icon: '⬛', name: 'Obsidian' },
    crystal:     { icon: '🔮', name: 'End Crystal' },
    pickaxe:     { icon: '⛏️', name: 'Picareta' },
    ender_pearl: { icon: '🟣', name: 'Ender Pearl' },
    firework:    { icon: '🎆', name: 'Fogos' },
    totem:       { icon: '🗿', name: 'Totem' },
    elytra:      { icon: '🪽', name: 'Elytra', slot: 'chestplate', maxDur: 10 },
    neth_helmet: { icon: '⛑️', name: 'Capacete Netherite', defense: 3, maxDur: 407, slot: 'helmet' },
    neth_chest:  { icon: '🦺', name: 'Peitoral Netherite', defense: 8, maxDur: 592, slot: 'chestplate' },
    neth_legs:   { icon: '👖', name: 'Calças Netherite', defense: 6, maxDur: 555, slot: 'leggings' },
    neth_boots:  { icon: '👢', name: 'Botas Netherite', defense: 3, maxDur: 481, slot: 'boots' },
};

// Hotbar 9 slots (objetos {id, dur}) - Configurado conforme pedido
const hotbar = [
    {id:'apple', dur:1},         // KeyU (Slot 0)
    {id:'sword', dur:100},       // KeyJ (Slot 1)
    {id:'wind_charge', dur:5},   // KeyK (Slot 2)
    {id:'shield', dur:100},      // KeyL (Slot 3)
    {id:'obsidian', dur:64},     // KeyO (Slot 4)
    {id:'iron_mace', dur:100},   // KeyI (Slot 5)
    null,                        // KeyM (Slot 6)
    {id:'crystal', dur:64},      // KeyN (Slot 7)
    null                         // KeyH (Slot 8)
];
let selectedSlot = 0;

// Inventário extra (27 slots) - Restante dos itens
const inventory = new Array(27).fill(null);
inventory[0] = {id:'trident', dur:100};
inventory[1] = {id:'ender_pearl', dur:16};
inventory[2] = {id:'firework', dur:16}; // Limite de 16 fogos
inventory[3] = {id:'pickaxe', dur:100};
inventory[4] = {id:'totem', dur:1};
inventory[5] = {id:'totem', dur:1};
inventory[6] = {id:'totem', dur:1};
inventory[7] = {id:'elytra', dur:10};

let totemsUsed = 0;
const MAX_TOTEMS = 3;

// Keybinds configuráveis
let keybinds = {
    up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD',
    use:'Space', block:'ShiftLeft', mine:'KeyM', inventory:'KeyE',
    slot1:'Digit1',slot2:'Digit2',slot3:'Digit3',slot4:'Digit4',slot5:'Digit5',
    slot6:'Digit6',slot7:'Digit7',slot8:'Digit8',slot9:'Digit9'
};

const player = {
    x:400, y:400, z:0, vz:0, width:40, height:40, speed:180,
    hp:40, maxHp:40, absorb:0, maxAbsorb:6,
    dirX:0, dirY:1, color:'#3498db',
    cooldowns:{attack:0,sword:0,mace:0,wind:0,obsidian:0,crystal:0,pickaxe:0,pearl:0,firework:0},
    isBlocking:false, isEating:false, appleTimer:0,
    attackTimer:0, currentWeapon:'',
    shieldCharges:5, shieldTimer:0, isMining:false,
    armor:{
        helmet:{id:'neth_helmet', dur:407},
        chestplate:{id:'neth_chest', dur:592},
        leggings:{id:'neth_legs', dur:555},
        boots:{id:'neth_boots', dur:481}
    },
    offhand:null, // Agora o player precisa colocar o totem aqui
    hasTotem:false,
    isGliding:false, elytraEquipped:false
};

const enemy = {
    x:800, y:400, z:0, vz:0, width:40, height:40, speed:155,
    hp:60, maxHp:60, dirX:-1, dirY:0, color:'#e74c3c',
    cooldowns:{sword:0,decision:0},
    isBlocking:false, isEating:false, appleTimer:0,
    attackTimer:0, state:'chase', currentWeapon:'sword',
    shieldCharges:5, shieldTimer:0, hasUsedApple:false
};

const mapObjects = [];
const floatingTexts = [];
const projectiles = [];

function addFloatingText(t,x,y,c){floatingTexts.push({text:t,x:x+(Math.random()*20-10),y:y-20,alpha:1.0,color:c});}

function getArmorDefense(){
    let d=0;
    for(const s in player.armor){const p=player.armor[s];if(p&&p.dur>0){const dd=ItemData[p.id];if(dd)d+=dd.defense;}}
    return d;
}
function applyDamageToPlayer(base){
    const def=getArmorDefense();
    const red=def*0.04;
    let dmg=Math.max(1,Math.round(base*(1-red)));
    // Absorção primeiro
    if(player.absorb>0){
        if(dmg<=player.absorb){player.absorb-=dmg;dmg=0;}
        else{dmg-=player.absorb;player.absorb=0;}
    }
    if(dmg>0) player.hp-=dmg;
    // Durabilidade das armaduras e Elytra
    for(const s in player.armor){
        const p=player.armor[s];
        if(p && p.dur>0){
            p.dur--;
            if(p.dur<=0){
                const data = ItemData[p.id];
                addFloatingText((data ? data.icon : '🛡️') +' Quebrou!', player.x, player.y-40, '#e74c3c');
                player.armor[s]=null;
            }
        }
    }
    return dmg;
}
function checkPlayerDeath(){
    if(player.hp<=0){
        if(player.offhand && player.offhand.id==='totem' && totemsUsed < MAX_TOTEMS){
            player.hp=10; // Recupera 10 de vida agora
            player.absorb=10; 
            totemsUsed++;
            player.offhand=null;
            addFloatingText('🗿 TOTEM USADO!', player.x, player.y-50, '#f1c40f');
            if(typeof window.renderInventoryUI === 'function') window.renderInventoryUI();
            return;
        }
        player.hp=0;gameState='GAMEOVER';
        document.getElementById('end-title').innerText='VOCÊ MORREU';
        document.getElementById('end-title').style.color='#e74c3c';
        document.getElementById('game-over-screen').style.display='flex';
    }
}

function applyDamageToEnemy(base){
    let dmg = Math.max(1, Math.round(base));
    if(enemy.absorb > 0){
        if(dmg <= enemy.absorb){ enemy.absorb -= dmg; dmg = 0; }
        else { dmg -= enemy.absorb; enemy.absorb = 0; }
    }
    if(dmg > 0) enemy.hp -= dmg;
    
    // LOGICA DO TOTEM DO NPC (Aqui garante que funciona antes de morrer)
    if(enemy.hp <= 0 && !enemy.hasUsedTotem){
        enemy.hp = 10;
        enemy.absorb = 10;
        enemy.hasUsedTotem = true;
        addFloatingText('🗿 TOTEM USADO!', enemy.x, enemy.y-50, '#f1c40f');
        return 0; // Evita morte imediata
    }
    
    if(enemy.hp <= 0) {
        enemy.hp = 0;
        if(typeof window.checkWin === 'function') window.checkWin();
    }
    return dmg;
}

let selectedInventoryItem=null;
let editingKeybind=null;
