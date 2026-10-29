const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
});
const fail = (message, status = 400) => json({ error: message }, status);
const cookieName = "velvet_admin";
const encoder = new TextEncoder();

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign","verify"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function makeSession(env) {
  const payload = `${Date.now() + 8 * 60 * 60 * 1000}`;
  return `${payload}.${await hmac(env.ADMIN_SESSION_SECRET, payload)}`;
}
async function validSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const found = cookie.split(";").map(s => s.trim()).find(s => s.startsWith(cookieName + "="));
  if (!found) return false;
  const token = decodeURIComponent(found.slice(cookieName.length + 1));
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot), signature = token.slice(dot + 1);
  if (!/^\d+$/.test(payload) || Number(payload) < Date.now()) return false;
  const expected = await hmac(env.ADMIN_SESSION_SECRET, payload);
  return signature === expected;
}
const sessionCookie = token => `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
const clearCookie = `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
async function body(request) {
  try { return await request.json(); } catch { return null; }
}
const text = (v, max = 5000) => typeof v === "string" ? v.trim().slice(0, max) : "";
const num = (v, min, max) => Number.isFinite(Number(v)) && String(v).trim() !== "" && Number(v) >= min && Number(v) <= max ? Number(v) : null;
const validUrl = v => { if (!v) return ""; try { const u = new URL(v); return ["https:","http:"].includes(u.protocol) ? u.toString().slice(0,1000) : ""; } catch { return ""; } };
const adminOnly = async (request, env) => await validSession(request, env);

export async function onRequest({request, env}) {
  if (!env.DB) return fail("데이터베이스 바인딩 DB가 설정되지 않았습니다.", 500);
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const method = request.method.toUpperCase();
  try {
    if (route === "auth" && method === "GET") return json({admin: await adminOnly(request, env)});
    if (route === "login" && method === "POST") {
      const b = await body(request);
      if (!b || typeof b.password !== "string") return fail("비밀번호를 입력해 주세요.");
      if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return fail("관리자 환경 변수가 설정되지 않았습니다.", 500);
      // Constant-time-ish compare via digest to avoid an early string comparison.
      const [provided, expected] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(b.password)),
        crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_PASSWORD))
      ]);
      const a = new Uint8Array(provided), z = new Uint8Array(expected);
      let diff = 0; for (let i=0;i<a.length;i++) diff |= a[i] ^ z[i];
      if (diff !== 0) return fail("비밀번호가 올바르지 않습니다.", 401);
      const token = await makeSession(env);
      return json({ok:true}, 200, {"set-cookie":sessionCookie(token)});
    }
    if (route === "logout" && method === "POST") return json({ok:true}, 200, {"set-cookie":clearCookie});
    if (route === "hosts" && method === "GET") {
      const {results} = await env.DB.prepare("SELECT id,name,age,height,color,tagline,image_url,bio,created_at FROM hosts WHERE active=1 ORDER BY created_at DESC").all();
      return json({hosts:results});
    }
    if (route === "hosts" && method === "POST") {
      if (!await adminOnly(request, env)) return fail("관리자 로그인이 필요합니다.", 401);
      const b = await body(request); if (!b) return fail("요청 내용을 확인해 주세요.");
      const name = text(b.name,60); if (!name) return fail("활동명을 입력해 주세요.");
      const age = b.age == null || b.age === "" ? null : num(b.age,18,99);
      const height = b.height == null || b.height === "" ? null : num(b.height,100,250);
      if (b.age !== null && b.age !== "" && age === null) return fail("나이는 18~99 사이로 입력해 주세요.");
      if (b.height !== null && b.height !== "" && height === null) return fail("키는 100~250 사이로 입력해 주세요.");
      const result = await env.DB.prepare("INSERT INTO hosts (name,age,height,color,tagline,image_url,bio) VALUES (?,?,?,?,?,?,?)")
        .bind(name,age,height,text(b.color,30),text(b.tagline,120),validUrl(b.image_url),text(b.bio,1000)).run();
      return json({ok:true,id:result.meta.last_row_id},201);
    }
    if (/^hosts\/\d+$/.test(route) && ["PUT","DELETE"].includes(method)) {
      if (!await adminOnly(request, env)) return fail("관리자 로그인이 필요합니다.",401);
      const id = Number(route.split("/")[1]);
      const existing = await env.DB.prepare("SELECT id FROM hosts WHERE id=? AND active=1").bind(id).first();
      if (!existing) return fail("호스트를 찾을 수 없습니다.",404);
      if (method === "DELETE") {
        await env.DB.prepare("UPDATE hosts SET active=0 WHERE id=?").bind(id).run();
        return json({ok:true});
      }
      const b=await body(request); if (!b) return fail("요청 내용을 확인해 주세요.");
      const name=text(b.name,60); if (!name) return fail("활동명을 입력해 주세요.");
      const age=b.age==null||b.age===""?null:num(b.age,18,99);
      const height=b.height==null||b.height===""?null:num(b.height,100,250);
      if (b.age!=null&&b.age!==""&&age===null) return fail("나이는 18~99 사이여야 합니다.");
      if (b.height!=null&&b.height!==""&&height===null) return fail("키는 100~250 사이여야 합니다.");
      await env.DB.prepare("UPDATE hosts SET name=?,age=?,height=?,color=?,tagline=?,image_url=?,bio=? WHERE id=?")
        .bind(name,age,height,text(b.color,30),text(b.tagline,120),validUrl(b.image_url),text(b.bio,1000),id).run();
      return json({ok:true});
    }
    if (/^posts\/\d+$/.test(route) && ["PUT","DELETE"].includes(method)) {
      if (!await adminOnly(request, env)) return fail("관리자 로그인이 필요합니다.",401);
      const id=Number(route.split("/")[1]);
      const existing=await env.DB.prepare("SELECT id FROM posts WHERE id=?").bind(id).first();
      if (!existing) return fail("공지사항을 찾을 수 없습니다.",404);
      if (method==="DELETE") {
        await env.DB.prepare("DELETE FROM comments WHERE post_id=?").bind(id).run();
        await env.DB.prepare("DELETE FROM posts WHERE id=?").bind(id).run();
        return json({ok:true});
      }
      const b=await body(request), title=text(b?.title,160), content=text(b?.body,5000);
      if (!title||!content) return fail("제목과 내용을 입력해 주세요.");
      await env.DB.prepare("UPDATE posts SET title=?,body=?,pinned=? WHERE id=?").bind(title,content,b.pinned?1:0,id).run();
      return json({ok:true});
    }
    if (route === "ranking" && method === "GET") {
      const {results} = await env.DB.prepare(`SELECT h.id,h.name,h.color,COALESCE(SUM(CASE WHEN p.created_at >= date('now','start of month') THEN p.points ELSE 0 END),0) AS points
        FROM hosts h LEFT JOIN point_logs p ON p.host_id=h.id WHERE h.active=1 GROUP BY h.id ORDER BY points DESC,h.name COLLATE NOCASE ASC LIMIT 100`).all();
      return json({ranking:results});
    }
    if (route === "attendance" && method === "GET") {
      const {results} = await env.DB.prepare(`SELECT h.id,h.name,a.status,a.note,a.updated_at FROM hosts h LEFT JOIN attendance a ON a.host_id=h.id AND a.work_date=date('now','localtime')
        WHERE h.active=1 ORDER BY CASE a.status WHEN 'on' THEN 0 WHEN '休' THEN 1 ELSE 2 END,h.name COLLATE NOCASE`).all();
      return json({attendance:results});
    }
    if (route === "attendance" && method === "POST") {
      if (!await adminOnly(request, env)) return fail("관리자 로그인이 필요합니다.",401);
      const b = await body(request); const hostId = num(b?.host_id,1,2147483647); const status = text(b?.status,10);
      if (!hostId || !["on","off","休"].includes(status)) return fail("호스트와 상태를 확인해 주세요.");
      await env.DB.prepare(`INSERT INTO attendance (host_id,work_date,status,note) VALUES (?,date('now','localtime'),?,?)
        ON CONFLICT(host_id,work_date) DO UPDATE SET status=excluded.status,note=excluded.note,updated_at=CURRENT_TIMESTAMP`)
        .bind(hostId,status,text(b.note,120)).run();
      return json({ok:true});
    }
    if (route === "posts" && method === "GET") {
      const {results} = await env.DB.prepare("SELECT id,title,body,pinned,created_at FROM posts ORDER BY pinned DESC,created_at DESC LIMIT 100").all();
      return json({posts:results});
    }
    if (route === "posts" && method === "POST") {
      if (!await adminOnly(request, env)) return fail("관리자 로그인이 필요합니다.",401);
      const b = await body(request); const title=text(b?.title,160), content=text(b?.body,5000);
      if (!title || !content) return fail("제목과 내용을 입력해 주세요.");
      const result = await env.DB.prepare("INSERT INTO posts (title,body,pinned) VALUES (?,?,?)").bind(title,content,b.pinned?1:0).run();
      return json({ok:true,id:result.meta.last_row_id},201);
    }
    if (route === "comments" && method === "GET") {
      const postId = num(url.searchParams.get("post_id"),1,2147483647); if (!postId) return fail("게시글 번호가 필요합니다.");
      const {results} = await env.DB.prepare("SELECT id,nickname,body,created_at FROM comments WHERE post_id=? ORDER BY created_at ASC LIMIT 200").bind(postId).all();
      return json({comments:results});
    }
    if (route === "comments" && method === "POST") {
      const b = await body(request); const postId=num(b?.post_id,1,2147483647), nickname=text(b?.nickname,30), content=text(b?.body,500);
      if (!postId || !nickname || !content) return fail("닉네임과 댓글을 입력해 주세요.");
      const post = await env.DB.prepare("SELECT id FROM posts WHERE id=?").bind(postId).first();
      if (!post) return fail("게시글을 찾을 수 없습니다.",404);
      await env.DB.prepare("INSERT INTO comments (post_id,nickname,body) VALUES (?,?,?)").bind(postId,nickname,content).run();
      return json({ok:true},201);
    }
    if (route === "guestbook" && method === "GET") {
      const {results} = await env.DB.prepare("SELECT id,nickname,message,created_at FROM guestbook ORDER BY created_at DESC LIMIT 50").all();
      return json({entries:results});
    }
    if (route === "guestbook" && method === "POST") {
      const b=await body(request), nickname=text(b?.nickname,30), message=text(b?.message,500);
      if (!nickname || !message) return fail("닉네임과 메시지를 입력해 주세요.");
      await env.DB.prepare("INSERT INTO guestbook (nickname,message) VALUES (?,?)").bind(nickname,message).run();
      return json({ok:true},201);
    }
    if (route === "points" && method === "POST") {
      if (!await adminOnly(request, env)) return fail("관리자 로그인이 필요합니다.",401);
      const b=await body(request), hostId=num(b?.host_id,1,2147483647), points=num(b?.points,-1000,1000), reason=text(b?.reason,200);
      if (!hostId || points === null || points === 0 || !reason) return fail("호스트, 0이 아닌 포인트, 지급 사유를 확인해 주세요.");
      const host=await env.DB.prepare("SELECT id FROM hosts WHERE id=? AND active=1").bind(hostId).first();
      if (!host) return fail("호스트를 찾을 수 없습니다.",404);
      await env.DB.prepare("INSERT INTO point_logs (host_id,points,reason) VALUES (?,?,?)").bind(hostId,points,reason).run();
      return json({ok:true},201);
    }
    return fail("요청한 API를 찾을 수 없습니다.",404);
  } catch (err) {
    return fail("서버 오류가 발생했습니다. 설정과 데이터베이스를 확인해 주세요.",500);
  }
}
