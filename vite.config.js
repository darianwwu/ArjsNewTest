import basicSsl from '@vitejs/plugin-basic-ssl'

export default {
  plugins: [
    basicSsl()
  ],
  base: './', // <-- Diese Zeile hinzufügen!
}
