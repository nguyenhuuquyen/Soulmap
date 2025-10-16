from flask import Flask, request, jsonify, send_from_directory, Response
import os
import json
import urllib.request
import urllib.error

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


@app.route('/api/workflow', methods=['POST', 'OPTIONS'])
def api_workflow():
    if request.method == 'OPTIONS':
        return Response(status=204)
    payload = request.get_json(silent=True) or {}
    full_name = payload.get('full_name', '').strip()
    date_of_birth = payload.get('date_of_birth', '').strip()
    lang = payload.get('lang', 'en').strip() or 'en'

    # Accept both base URL (https://api.dify.ai/v1) or full endpoint (https://api.dify.ai/v1/workflows/run)
    api_base = os.environ.get('DIFY_API_URL', 'https://api.dify.ai/v1').strip()
    base_no_slash = api_base.rstrip('/')
    if base_no_slash.endswith('/workflows/run'):
        api_url = api_base
    else:
        api_url = base_no_slash + '/workflows/run'
    api_key = os.environ.get('DIFY_API_KEY')
    if not api_key:
        return jsonify({'error': 'DIFY_API_KEY not set'}), 500

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

    try:
        req = urllib.request.Request(api_url, data=data, method='POST')
        req.add_header('Content-Type', 'application/json')
        # api_key should include the full 'Bearer ...' per spec
        req.add_header('Authorization', api_key)
        with urllib.request.urlopen(req) as r:
            resp_body = r.read()
            content_type = r.headers.get('Content-Type', 'application/json')
        # Prefer JSON; fall back to raw
        try:
            parsed = json.loads(resp_body.decode('utf-8'))
            return jsonify(parsed), 200
        except Exception:
            return Response(resp_body, status=200, content_type=content_type)
    except urllib.error.HTTPError as e:
        # Return API error body for better debugging on client side
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
        with urllib.request.urlopen(req) as r:
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
    # Use different port to avoid collision
    app.run(host='0.0.0.0', port=5052)