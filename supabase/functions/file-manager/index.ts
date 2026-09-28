import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FileRequest {
  action: 'list' | 'read' | 'write' | 'delete' | 'mkdir' | 'upload';
  path: string;
  content?: string;
  encoding?: 'utf8' | 'base64';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verifica admin (puoi personalizzare)
    const { data: profile } = await supabase.from('staff_users').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin required' }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body: FileRequest = await req.json()
    const basePath = Deno.env.get('FILE_MANAGER_BASE_PATH') || '/opt/risto'
    const fullPath = `${basePath}/${body.path}`.replace(/\/+/g, '/')

    // Sicurezza: path traversal protection
    const resolvedBase = await Deno.realPath(basePath)
    const resolvedPath = await Deno.realPath(fullPath).catch(() => fullPath)
    if (!resolvedPath.startsWith(resolvedBase)) {
      return new Response(JSON.stringify({ error: 'Path traversal denied' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    switch (body.action) {
      case 'list': {
        const entries = []
        for await (const entry of Deno.readDir(resolvedPath)) {
          const stat = await Deno.stat(`${resolvedPath}/${entry.name}`)
          entries.push({
            name: entry.name,
            isDirectory: entry.isDirectory,
            size: stat.size,
            modified: stat.mtime?.toISOString()
          })
        }
        return new Response(JSON.stringify({ files: entries }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'read': {
        const content = await Deno.readTextFile(resolvedPath)
        return new Response(JSON.stringify({ content }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'write': {
        const encoder = new TextEncoder()
        await Deno.writeFile(resolvedPath, encoder.encode(body.content || ''))
        return new Response(JSON.stringify({ ok: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'delete': {
        await Deno.remove(resolvedPath, { recursive: true })
        return new Response(JSON.stringify({ ok: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'mkdir': {
        await Deno.mkdir(resolvedPath, { recursive: true })
        return new Response(JSON.stringify({ ok: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'upload': {
        // Per upload multipart, serve parsing form-data
        // Implementazione semplificata: accetta base64
        if (body.encoding === 'base64' && body.content) {
          const binary = Uint8Array.from(atob(body.content), c => c.charCodeAt(0))
          await Deno.writeFile(resolvedPath, binary)
          return new Response(JSON.stringify({ ok: true }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        return new Response(JSON.stringify({ error: 'Upload requires base64 encoding' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})