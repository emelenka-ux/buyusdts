<?php
// Админка Buy_USDTs — установка курса юаня (CNY). USDT/RUB обновляется автоматически кроном.
header('X-Robots-Tag: noindex, nofollow');
$PASS_FILE = '/etc/buyusdt-admin.pass';
$RATES = __DIR__ . '/rates.json';

$pass = is_readable($PASS_FILE) ? trim(file_get_contents($PASS_FILE)) : '';
$data = is_readable($RATES) ? json_decode(file_get_contents($RATES), true) : [];
if (!is_array($data)) $data = [];
$data += ['cny_rub'=>0,'usdt_buy'=>0,'usdt_sell'=>0,'usdt_cny'=>0,'fee'=>0.005,'updated'=>''];

$msg = ''; $ok = false; $authed = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $given = $_POST['pass'] ?? '';
  if ($pass !== '' && hash_equals($pass, $given)) {
    $authed = true;
    if (isset($_POST['cny'])) {
      $cny = floatval(str_replace(',', '.', $_POST['cny']));
      $fee = isset($_POST['fee']) ? floatval(str_replace(',', '.', $_POST['fee'])) : $data['fee'];
      if ($cny > 0) {
        $data['cny_rub'] = round($cny, 4);
        $data['fee'] = min(max(0, $fee), 100) / 100; // поле в процентах: 0.5 → 0.005
        if (file_put_contents($RATES, json_encode($data, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)) !== false) {
          $ok = true; $msg = 'Курс сохранён ✅';
        } else { $msg = 'Ошибка записи rates.json (права доступа).'; }
      } else { $msg = 'Введите корректный курс юаня.'; }
    }
  } else {
    $msg = 'Неверный пароль.';
  }
}
$feePct = rtrim(rtrim(number_format(($data['fee']*100), 2, '.', ''), '0'), '.');
?>
<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Админка — Buy_USDTs</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#0b0b0b;color:#eee;font-family:-apple-system,Inter,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
  .card{width:100%;max-width:420px;background:#141414;border:1px solid #262626;border-radius:14px;padding:28px}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#888;font-size:13px;margin:0 0 22px}
  label{display:block;font-size:13px;color:#aaa;margin:14px 0 6px}
  input{width:100%;background:#0b0b0b;border:1px solid #333;border-radius:10px;padding:12px 14px;color:#fff;font-size:16px}
  input:focus{outline:none;border-color:#27e39f}
  button{width:100%;margin-top:20px;background:#27e39f;color:#06231a;border:0;border-radius:100px;padding:13px;font-size:15px;font-weight:700;cursor:pointer}
  .msg{margin:14px 0 0;padding:10px 14px;border-radius:10px;font-size:14px}
  .msg.ok{background:rgba(39,227,159,.12);color:#27e39f} .msg.err{background:rgba(227,80,80,.12);color:#e35050}
  .info{margin-top:22px;padding-top:16px;border-top:1px solid #262626;font-size:13px;color:#888;line-height:1.7}
  .info b{color:#ddd}
</style></head><body>
<div class="card">
  <h1>Курс — Buy_USDTs</h1>
  <p class="sub">Юань ставите вы. Доллар/USDT обновляется с биржи автоматически.</p>

  <?php if ($msg): ?><div class="msg <?= $ok ? 'ok':'err' ?>"><?= htmlspecialchars($msg) ?></div><?php endif; ?>

  <form method="post" autocomplete="off">
    <label>Пароль</label>
    <input type="password" name="pass" required <?= $authed ? 'value=""':'' ?>>
    <label>Курс юаня, ₽ за 1 CNY</label>
    <input type="text" name="cny" inputmode="decimal" value="<?= htmlspecialchars((string)$data['cny_rub']) ?>" placeholder="например 12.50" required>
    <label>Комиссия, %</label>
    <input type="text" name="fee" inputmode="decimal" value="<?= htmlspecialchars($feePct) ?>" placeholder="0.5">
    <button type="submit">Сохранить курс</button>
  </form>

  <div class="info">
    <b>Текущие курсы:</b><br>
    Юань (CNY): <b><?= htmlspecialchars((string)$data['cny_rub']) ?> ₽</b><br>
    USDT покупка: <b><?= htmlspecialchars((string)$data['usdt_buy']) ?> ₽</b> · продажа: <b><?= htmlspecialchars((string)$data['usdt_sell']) ?> ₽</b><br>
    Комиссия: <b><?= htmlspecialchars($feePct) ?>%</b><br>
    Обновлено (USDT): <b><?= htmlspecialchars($data['updated'] ?: '—') ?></b>
  </div>
</div>
</body></html>
