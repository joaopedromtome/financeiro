// ═══════════════════════════════════════════════════════════════
//  BACKEND — Auth + Storage
//  Roteia para Supabase (se configurado) ou localStorage (fallback).
//  Carregado como <script type="module">.
// ═══════════════════════════════════════════════════════════════

const cfg = window.SUPABASE_CONFIG || {};
const isCloud = !!(cfg.url && cfg.anonKey) &&
                !String(cfg.url).startsWith("REPLACE") &&
                !String(cfg.anonKey).startsWith("REPLACE");

// ── HASH simples (apenas para modo local) ──
function simpleHash(str){
  let h=0;
  for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0;}
  return h.toString(16);
}
function genCode(){let s="";for(let i=0;i<6;i++)s+=Math.floor(Math.random()*10);return s;}

// ── Cliente Supabase (lazy) ──
let supa = null;
async function initSupa(){
  if(supa || !isCloud) return supa;
  try{
    const mod = await import("https://esm.sh/@supabase/supabase-js@2");
    supa = mod.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return supa;
  }catch(e){
    console.error("[Backend] Falha ao iniciar Supabase:",e);
    throw e;
  }
}

const TABLE = "user_data";

// ═══════════════════════════════════════════════════════════════
//  BACKEND PÚBLICO
// ═══════════════════════════════════════════════════════════════
const readyPromise = (async function(){
  if(isCloud){
    try{ await initSupa(); }catch(e){/* degrada para local */}
  }
})();

window.Backend = {
  mode: isCloud ? "cloud" : "local",
  ready(){ return readyPromise; },

  // ──────────────────────────────────────────────────────────
  //  SIGN UP
  // ──────────────────────────────────────────────────────────
  async signUp({email, password, name, char}){
    email = email.trim().toLowerCase();
    if(isCloud && supa){
      const { data, error } = await supa.auth.signUp({
        email, password,
        options: {
          data: { nome: name, char: char || "kuromi" },
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
      if(error){
        const e = new Error(error.message);
        if(/already/i.test(error.message) || error.status === 400 && /registered/i.test(error.message)) e.code = "EMAIL_EXISTS";
        throw e;
      }
      // Se "Confirm email" está OFF no Supabase, data.session existe e o user já está logado.
      // Aqui forçamos sair pra fluxo padrão pedir confirmação.
      try{ await supa.auth.signOut(); }catch(e){}
      return { mode:"cloud", email, name, mustVerify:true };
    }
    // ── modo local ──
    const users = JSON.parse(localStorage.getItem("mpf_users")||"{}");
    if(users[email] && users[email].verified) { const e=new Error("EMAIL_EXISTS");e.code="EMAIL_EXISTS";throw e; }
    const code = genCode();
    users[email] = {
      passHash: simpleHash(password),
      nome: name,
      char: char || "kuromi",
      orcamento: 0,
      verified: false,
      verifyCode: code
    };
    localStorage.setItem("mpf_users", JSON.stringify(users));
    return { mode:"local", email, name, mustVerify:true, verifyCode: code };
  },

  // ──────────────────────────────────────────────────────────
  //  SIGN IN
  // ──────────────────────────────────────────────────────────
  async signIn({email, password}){
    email = email.trim().toLowerCase();
    if(isCloud && supa){
      const { data, error } = await supa.auth.signInWithPassword({ email, password });
      if(error){
        const msg = String(error.message||"").toLowerCase();
        const e = new Error(error.message);
        if(msg.includes("email not confirmed") || msg.includes("not confirmed")){ e.code = "EMAIL_NOT_VERIFIED"; }
        else if(msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("invalid email or password")){
          // Pode ser senha errada OU usuário inexistente — Supabase não diferencia
          e.code = "INVALID_CREDENTIALS";
        }
        else if(msg.includes("rate limit")) e.code = "RATE_LIMIT";
        throw e;
      }
      const user = data.user;
      // Carrega/cria registro em user_data
      const userData = await loadOrCreateUserData(user, name => name || user.user_metadata?.nome || email);
      // Migração local → cloud (uma vez)
      await maybeMigrateLocal(email, user.id, userData);
      return { mode:"cloud", uid:user.id, email, ...userData };
    }
    // ── modo local ──
    const users = JSON.parse(localStorage.getItem("mpf_users")||"{}");
    if(!users[email]) { const e=new Error("USER_NOT_FOUND");e.code="USER_NOT_FOUND";throw e; }
    if(users[email].passHash !== simpleHash(password)){ const e=new Error("WRONG_PASSWORD");e.code="WRONG_PASSWORD";throw e; }
    if(!users[email].verified){
      const e = new Error("EMAIL_NOT_VERIFIED"); e.code="EMAIL_NOT_VERIFIED";
      e.verifyCode = users[email].verifyCode || genCode();
      if(!users[email].verifyCode){
        users[email].verifyCode = e.verifyCode;
        localStorage.setItem("mpf_users", JSON.stringify(users));
      }
      e.userName = users[email].nome;
      throw e;
    }
    const data = JSON.parse(localStorage.getItem("mpf_data_"+email)||"null") || { store:{}, metas:[], cartoes:[], parcelas:[], aportes:[] };
    return { mode:"local", email, nome: users[email].nome, char: users[email].char||"kuromi", orcamento: users[email].orcamento||0, ...data };
  },

  // ──────────────────────────────────────────────────────────
  //  VERIFY — confirma cadastro
  //   modo local: confere código de 6 dígitos
  //   modo cloud: re-tenta login pra checar se já confirmou pelo link
  // ──────────────────────────────────────────────────────────
  async verify({email, code, password}){
    email = email.trim().toLowerCase();
    if(isCloud && supa){
      if(!password) { const e=new Error("PASSWORD_REQUIRED");e.code="PASSWORD_REQUIRED";throw e; }
      const { data, error } = await supa.auth.signInWithPassword({ email, password });
      if(error){
        const msg = String(error.message||"").toLowerCase();
        if(msg.includes("not confirmed")){ const e=new Error("STILL_NOT_VERIFIED");e.code="STILL_NOT_VERIFIED";throw e; }
        throw error;
      }
      try{ await supa.auth.signOut(); }catch(e){}
      return { ok:true };
    }
    // ── modo local ──
    const users = JSON.parse(localStorage.getItem("mpf_users")||"{}");
    if(!users[email]) throw new Error("USER_NOT_FOUND");
    if(users[email].verifyCode !== code) { const e=new Error("WRONG_CODE");e.code="WRONG_CODE";throw e; }
    users[email].verified = true;
    delete users[email].verifyCode;
    localStorage.setItem("mpf_users", JSON.stringify(users));
    return { ok:true };
  },

  async resendVerification({email, password}){
    email = email.trim().toLowerCase();
    if(isCloud && supa){
      const { error } = await supa.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
      if(error) throw error;
      return { ok:true };
    }
    // ── modo local: gera novo código ──
    const users = JSON.parse(localStorage.getItem("mpf_users")||"{}");
    if(!users[email]) throw new Error("USER_NOT_FOUND");
    const code = genCode();
    users[email].verifyCode = code;
    localStorage.setItem("mpf_users", JSON.stringify(users));
    return { ok:true, code };
  },

  // ──────────────────────────────────────────────────────────
  //  SAVE
  // ──────────────────────────────────────────────────────────
  async save({email, data}){
    email = email.trim().toLowerCase();
    if(isCloud && supa){
      const { data:s } = await supa.auth.getSession();
      const session = s.session;
      if(session && session.user){
        const row = {
          uid: session.user.id,
          email: session.user.email,
          nome: data.nome,
          char: data.char,
          orcamento: data.orcamento,
          store: data.store || {},
          metas: data.metas || [],
          cartoes: data.cartoes || [],
          parcelas: data.parcelas || [],
          aportes: data.aportes || [],
          updated_at: new Date().toISOString()
        };
        const { error } = await supa.from(TABLE).upsert(row, { onConflict: "uid" });
        if(error) console.warn("[Backend.save]", error.message);
        return;
      }
    }
    // ── modo local ──
    const users = JSON.parse(localStorage.getItem("mpf_users")||"{}");
    if(users[email]){
      users[email].nome = data.nome;
      users[email].char = data.char;
      users[email].orcamento = data.orcamento;
      localStorage.setItem("mpf_users", JSON.stringify(users));
    }
    localStorage.setItem("mpf_data_"+email, JSON.stringify({
      store:data.store, metas:data.metas, cartoes:data.cartoes, parcelas:data.parcelas, aportes:data.aportes
    }));
  },

  async signOut(){
    if(isCloud && supa){
      try{ await supa.auth.signOut(); }catch(e){}
    }
  },

  // ──────────────────────────────────────────────────────────
  //  CHANGE PASSWORD
  // ──────────────────────────────────────────────────────────
  async changePassword({email, oldPassword, newPassword}){
    email = email.trim().toLowerCase();
    if(isCloud && supa){
      // re-autentica
      const { error: err1 } = await supa.auth.signInWithPassword({ email, password: oldPassword });
      if(err1){ const e=new Error(err1.message);e.code="WRONG_OLD_PASSWORD";throw e; }
      const { error: err2 } = await supa.auth.updateUser({ password: newPassword });
      if(err2) throw err2;
      return { ok:true };
    }
    // ── modo local ──
    const users = JSON.parse(localStorage.getItem("mpf_users")||"{}");
    if(!users[email]) throw new Error("USER_NOT_FOUND");
    if(users[email].passHash !== simpleHash(oldPassword)) { const e=new Error("WRONG_OLD_PASSWORD");e.code="WRONG_OLD_PASSWORD";throw e; }
    users[email].passHash = simpleHash(newPassword);
    localStorage.setItem("mpf_users", JSON.stringify(users));
    return { ok:true };
  },

  // ──────────────────────────────────────────────────────────
  //  RESTORE SESSION (cloud only)
  // ──────────────────────────────────────────────────────────
  async restoreSession(){
    if(!(isCloud && supa)) return null;
    try{
      const { data } = await supa.auth.getSession();
      const session = data && data.session;
      if(!session || !session.user) return null;
      // Email confirmado?
      if(!session.user.email_confirmed_at){
        await supa.auth.signOut();
        return null;
      }
      const userData = await loadOrCreateUserData(session.user);
      return { mode:"cloud", uid:session.user.id, email:session.user.email, ...userData };
    }catch(e){ console.warn("[restoreSession]",e); return null; }
  }
};

// ═══════════════════════════════════════════════════════════════
//  Helpers privados
// ═══════════════════════════════════════════════════════════════
async function loadOrCreateUserData(user){
  const { data, error } = await supa.from(TABLE).select("*").eq("uid", user.id).maybeSingle();
  if(error){ console.warn("[loadUserData]",error.message); }
  if(data) return {
    nome: data.nome || user.user_metadata?.nome || user.email,
    char: data.char || "kuromi",
    orcamento: data.orcamento || 0,
    store: data.store || {},
    metas: data.metas || [],
    cartoes: data.cartoes || [],
    parcelas: data.parcelas || [],
    aportes: data.aportes || []
  };
  // não existe → cria registro inicial
  const initial = {
    uid: user.id,
    email: user.email,
    nome: user.user_metadata?.nome || user.email,
    char: user.user_metadata?.char || "kuromi",
    orcamento: 0,
    store: {}, metas: [], cartoes: [], parcelas: [], aportes: []
  };
  await supa.from(TABLE).insert(initial);
  return {
    nome: initial.nome, char: initial.char, orcamento: 0,
    store:{}, metas:[], cartoes:[], parcelas:[], aportes:[]
  };
}

async function maybeMigrateLocal(email, uid, userData){
  try{
    const local = JSON.parse(localStorage.getItem("mpf_data_"+email)||"null");
    if(!local) return;
    const cloudHasData = (userData.store && Object.keys(userData.store).length) ||
                        (userData.metas && userData.metas.length) ||
                        (userData.cartoes && userData.cartoes.length) ||
                        (userData.parcelas && userData.parcelas.length) ||
                        (userData.aportes && userData.aportes.length);
    if(cloudHasData) return; // já tem dados em nuvem — não sobrescreve
    const localHasData = (local.store && Object.keys(local.store).length) ||
                        (local.metas && local.metas.length) ||
                        (local.cartoes && local.cartoes.length) ||
                        (local.parcelas && local.parcelas.length) ||
                        (local.aportes && local.aportes.length);
    if(!localHasData) return;
    // sobe pro Supabase
    await supa.from(TABLE).update({
      store: local.store || {},
      metas: local.metas || [],
      cartoes: local.cartoes || [],
      parcelas: local.parcelas || [],
      aportes: local.aportes || [],
      updated_at: new Date().toISOString()
    }).eq("uid", uid);
    // Atualiza retorno
    Object.assign(userData, {
      store: local.store || {},
      metas: local.metas || [],
      cartoes: local.cartoes || [],
      parcelas: local.parcelas || [],
      aportes: local.aportes || []
    });
    localStorage.removeItem("mpf_data_"+email);
    console.log("[Backend] Dados locais migrados → Supabase");
  }catch(e){ console.warn("[migrate]",e); }
}

console.log("[Backend] modo: " + window.Backend.mode);
