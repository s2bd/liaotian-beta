# Liaotian 聊天
easy-to-host social platforms for everyone

```
Current version: 1.0.3
```

- [x] Post on the feed and customize profiles like X/Twitter
- [x] Messaging like Telegram/WhatsApp
- [x] User following/followers
- [x] User profiles via url parameters (e.g. [lt.mux8.com/?liaotian](https://lt.mux8.com/?liaotian))
- [x] Animated GIFs eligible for profile customization
- [x] Upload files (max 10 MB)
- [x] Upload images, videos, documents (txt, pdf, doc/x)
- [ ] Embed links
- [ ] Create and manage groups
- [ ] Host audio and video calls
- [ ] Posting long-form content, e.g. blogs
- [ ] Custom pages/sections

### What makes LiaoTian (LT) so special from already existing social media/networking platforms?

This is a project where **anyone can easily fork/clone and deploy their own** versions of this platform. This GitHub repository provides a sort of boilerplate template for making your own such platforms, in a way.
Unlike Mastodon and other open-source and decentralized or fediverse alternatives like this, the code is **compiled into a static site**, meaning it can be easily **hosted on most free hosting providers** for $0. All it needs is a database connection via Supabase. The content **behaves as if it is dynamic and real-time**, thanks to both Vercel (as what we have used) and Supabase's real-time API features.
Also to get started on developing your own version of LiaoTian, it's much simpler than most other "templates" out there, since it uses **only 7 files** for its actual codebase (as of now).

---

## 👤 Use LiaoTian itself
If you just want to create an account on **LiaoTian** (our official deployment) then [sign up here](https://liaotian.mux8.com/).

## 🌐 Host your own LiaoTian
1. Fork this repository to your GitHub account.
2. Connect this repository to your Vercel account.
3. Create a Supabase database.
4. Insert the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on **Vercel** according to your **Supabase** API connection system (choose App:NextJS).
5. If all steps are correct, you should be able to see your own instance of LiaoTian ready and deployed! Have fun customizing it to your needs.

## 🎨 Customization options
Currently, the following features can be customized by inserting/modifying the following environment vaiables on your deployment (e.g. Vercel):
1. **`VITE_FOLLOW_ONLY_FEED`** = `true` (will show only followed users' posts in the feed), `false` or missing (will show all posts from all users)

[LiaoTian](https://github.com/huanmux/liaotian) is a digital product brand/project by [Mux ZiZhiZhe Co.](https://mux8.com/zzz) under [HuanMux](https://www.linkedin.com/company/huanmux).
