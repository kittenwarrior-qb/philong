# philong

Portfolio showcase nhân vật 3D (Mixamo FBX) bằng Three.js + Vite.

## Chạy local

```bash
npm install
npm run dev
```

## Thêm animation

Copy file `.fbx` từ Mixamo vào `public/models/`, rồi thêm một dòng vào mảng `STATES` trong `src/main.js`.

## Deploy

Import repo trên Vercel (framework Vite tự nhận), hoặc `npx vercel --prod`.
