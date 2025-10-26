from flask import Flask, request, jsonify, send_from_directory, Response
import os
import json
import urllib.request
import urllib.error
import time
import socket

app = Flask(__name__, static_folder='.', static_url_path='')


@app.after_request
def add_cors_headers(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-control-Allow-Headers'] = 'Content-Type, Authorization'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return resp


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Global visits counter initialized via environment variable VISITS_INIT (default 0)
import threading
_visits_lock = threading.Lock()
_visits_count = int(os.environ.get('VISITS_INIT', '0') or '0')

@app.route('/api/visit', methods=['GET', 'POST', 'OPTIONS'])
def api_visit():
    global _visits_count
    if request.method == 'OPTIONS':
        return Response(status=204)
    with _visits_lock:
        if request.method == 'POST':
            _visits_count += 1
        current = _visits_count
    return jsonify({'visits': current}), 200


def urlopen_with_retry(req, timeout=90, retries=2, backoff=1.0):
    last_exc = None
    for attempt in range(retries + 1):
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            if e.code in (502, 503, 504) and attempt < retries:
                time.sleep(backoff * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, socket.timeout) as e:
            last_exc = e
            msg = str(getattr(e, 'reason', e)).lower()
            if ('timed out' in msg or 'timeout' in msg) and attempt < retries:
                time.sleep(backoff * (attempt + 1))
                continue
            if attempt < retries:
                time.sleep(backoff * (attempt + 1))
                continue
            raise
        except Exception as e:
            last_exc = e
            if attempt < retries:
                time.sleep(backoff * (attempt + 1))
                continue
            raise
    if last_exc:
        raise last_exc


@app.route('/api/workflow', methods=['POST', 'OPTIONS'])
def api_workflow():
    if request.method == 'OPTIONS':
        return Response(status=204)
    payload = request.get_json(silent=True) or {}
    full_name = payload.get('full_name', '').strip()
    date_of_birth = payload.get('date_of_birth', '').strip()
    lang = payload.get('lang', 'en').strip() or 'en'

    # Accept both base URL (https://api.dify.ai/v1) or full endpoint (https://api.dify.ai/v1/workflows/run)
    api_base = (os.environ.get('DIFY_WORKFLOW_API_URL') or os.environ.get('DIFY_API_URL', 'https://api.dify.ai/v1')).strip()
    base_no_slash = api_base.rstrip('/')
    if base_no_slash.endswith('/workflows/run'):
        api_url = api_base
    else:
        api_url = base_no_slash + '/workflows/run'
    api_key = os.environ.get('DIFY_WORKFLOW_API_KEY') or os.environ.get('DIFY_API_KEY')
    if not api_key:
        return jsonify({'error': 'DIFY_WORKFLOW_API_KEY not set'}), 500

    body = {
        'inputs': {
            'full_name': full_name,
            'date_of_birth': date_of_birth,
            'lang': lang
        },
        'user': os.environ.get('WORKFLOW_USER_ID', 'apple-001'),
        'response_mode': 'blocking'
    }
    data = json.dumps(body).encode('utf-8')

    start = time.time()
    try:
        req = urllib.request.Request(api_url, data=data, method='POST')
        req.add_header('Content-Type', 'application/json')
        # api_key should include the full 'Bearer ...' per spec
        req.add_header('Authorization', api_key)
        with urlopen_with_retry(req, timeout=120, retries=3) as r:
            resp_body = r.read()
            content_type = r.headers.get('Content-Type', 'application/json')
        dur = time.time() - start
        try:
            parsed = json.loads(resp_body.decode('utf-8'))
            # Unwrap possible top-level 'data' from Dify
            inner = parsed.get('data', parsed)
            outputs = inner.get('outputs') or {}
            result = outputs.get('result') or {}

            # Normalize fields expected by frontend
            def pick(k):
                return outputs.get(k) or result.get(k)

            normalized = {
                'core': pick('core') or {},
                'interpretation': pick('interpretation') or {},
                'share': pick('share') or {},
                'visual': pick('visual') or {},
                'personal_year': pick('personal_year') or {},
                'personal_year_advice': pick('personal_year_advice') or '',
                'core_details': pick('core_details') or {},
                'chat_prompts': pick('chat_prompts') or None,
            }

            # Derive image_url from outputs.image (stringified JSON) if needed
            image_url = inner.get('image_url') or outputs.get('image_url') or result.get('image_url') or ''
            img_raw = outputs.get('image')
            if not image_url and img_raw:
                if isinstance(img_raw, str):
                    try:
                        img_obj = json.loads(img_raw)
                        image_url = (img_obj.get('images') or [{}])[0].get('url') or (img_obj.get('data') or [{}])[0].get('url') or ''
                    except Exception:
                        pass
                elif isinstance(img_raw, dict):
                    image_url = (img_raw.get('images') or [{}])[0].get('url') or (img_raw.get('data') or [{}])[0].get('url') or ''
            normalized['image_url'] = image_url

            # Also include an 'outputs' block so validators in frontend pass
            normalized['outputs'] = {
                'core': normalized['core'],
                'interpretation': normalized['interpretation'],
                'share': normalized['share'],
                'image_url': normalized['image_url'],
                'core_details': normalized['core_details'],
                'chat_prompts': normalized['chat_prompts'],
            }

            app.logger.info(f"/api/workflow OK in {dur:.1f}s (normalized)")
            return jsonify(normalized), 200
        except Exception:
            app.logger.info(f"/api/workflow RAW OK in {dur:.1f}s, type={content_type}")
            return Response(resp_body, status=200, content_type=content_type)
    except urllib.error.HTTPError as e:
        dur = time.time() - start
        try:
            resp_body = e.read()
            content_type = e.headers.get('Content-Type', 'application/json')
            app.logger.warning(f"/api/workflow HTTP {e.code} in {dur:.1f}s: {resp_body[:200]}")
            return Response(resp_body, status=e.code, content_type=content_type)
        except Exception:
            app.logger.warning(f"/api/workflow HTTP {e.code} in {dur:.1f}s (no body)")
            return jsonify({'error': f'HTTP {e.code}'}), e.code
    except Exception as e:
        dur = time.time() - start
        msg = str(e)
        app.logger.error(f"/api/workflow ERR in {dur:.1f}s: {msg}")
        if 'timed out' in msg.lower() or 'timeout' in msg.lower():
            return jsonify({'error': msg}), 504
        return jsonify({'error': msg}), 500


@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def api_chat():
    if request.method == 'OPTIONS':
        return Response(status=204)
    payload = request.get_json(silent=True) or {}
    user = payload.get('user') or os.environ.get('WORKFLOW_USER_ID', 'apple-001')
    query = (payload.get('query') or '').strip()
    inputs = payload.get('inputs') or {}
    if not query:
        return jsonify({'error': 'missing query'}), 400

    api_base = (os.environ.get('DIFY_CHAT_API_URL') or os.environ.get('DIFY_API_URL', 'https://api.dify.ai/v1')).strip()
    base_no_slash = api_base.rstrip('/')
    # Accept either full or base
    if base_no_slash.endswith('/chat-messages'):
        api_url = base_no_slash
    else:
        api_url = base_no_slash + '/chat-messages'
    api_key = os.environ.get('DIFY_CHAT_API_KEY') or os.environ.get('DIFY_API_KEY')
    if not api_key:
        return jsonify({'error': 'DIFY_CHAT_API_KEY not set'}), 500

    body = {
        'user': user,
        'query': query,
        'inputs': inputs,
        'response_mode': 'blocking'
    }
    data = json.dumps(body).encode('utf-8')
    try:
        req = urllib.request.Request(api_url, data=data, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Authorization', api_key)
        with urlopen_with_retry(req, timeout=60, retries=1) as r:
            resp_body = r.read()
            content_type = r.headers.get('Content-Type', 'application/json')
        try:
            parsed = json.loads(resp_body.decode('utf-8'))
            return jsonify(parsed), 200
        except Exception:
            return Response(resp_body, status=200, content_type=content_type)
    except urllib.error.HTTPError as e:
        try:
            resp_body = e.read()
            content_type = e.headers.get('Content-Type', 'application/json')
            return Response(resp_body, status=e.code, content_type=content_type)
        except Exception:
            return jsonify({'error': f'HTTP {e.code}'}), e.code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/proxy_image')
def proxy_image():
    # Proxy remote image to avoid client-side CORS issues when downloading
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'missing url'}), 400
    try:
        req = urllib.request.Request(url, method='GET')
        with urlopen_with_retry(req, timeout=30, retries=1) as r:
            content_type = r.headers.get('Content-Type', 'image/png')
            body = r.read()
        return Response(body, status=200, content_type=content_type)
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
            return Response(body, status=e.code, content_type=e.headers.get('Content-Type', 'application/octet-stream'))
        except Exception:
            return jsonify({'error': f'HTTP {e.code}'}), e.code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Allow override via env PORT to avoid collision
    port = int(os.environ.get('PORT', '5052'))
    app.run(host='0.0.0.0', port=port)