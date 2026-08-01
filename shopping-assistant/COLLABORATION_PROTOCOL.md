# COLLABORATION_PROTOCOL.md

## מטרה
להפעיל את ChatGPT ו-Claude Code כצוות פיתוח משלים, עם מינימום כפילות, מינימום טוקנים ומקסימום איכות.

## מקור אמת יחיד
- Repository: `avi7756-design/mind-space`
- Project root: `shopping-assistant/`
- Source branch: `claude/shopping-assistant-app-139m55`
- ChatGPT branch: `chatgpt/shopping-v2-foundation`
- אין לעבוד ב-`main` ואין לערוך את `shopping/` ישירות.

## חלוקת אחריות
### ChatGPT
- ארכיטקטורה, סדרי עדיפויות ו-Definition of Done.
- סקירת קוד, זיהוי סיכונים ובדיקת עקביות בין שכבות.
- תכנון מודל נתונים, API, אבטחה, UX, iPhone/PWA ו-AI.
- כתיבת מפרטי משימה קצרים ומדויקים.
- בדיקת diff ו-PR לפני מיזוג.

### Claude Code
- מימוש בפועל בקוד.
- הרצת build, lint, typecheck ובדיקות.
- תיקון תקלות מקומיות ורפקטורינג לפי מפרט.
- יצירת commits קטנים ומבודדים.
- דיווח תוצאה תמציתי עם קבצים ששונו ותוצאות בדיקות.

## כללי חסכון בטוקנים
1. לא שולחים מחדש קבצים שלמים; מפנים לנתיב ו-commit SHA.
2. כל משימה מוגבלת ליעד אחד ברור.
3. Claude קורא רק את הקבצים שהוגדרו במפרט.
4. ChatGPT בודק diff בלבד, לא את כל המאגר מחדש.
5. אין להעתיק PROJECT_HANDOFF או AI_CONTEXT לשיחה; רק לציין שהם מקור מחייב.
6. כל דיווח סיום מוגבל ל-12 שורות, אלא אם נמצאה תקלה קריטית.
7. כל שינוי פונקציונלי כולל בדיקה אוטומטית או הסבר מדוע אינה אפשרית.
8. אין לבצע רפקטורינג לא קשור למשימה.

## מחזור עבודה
1. ChatGPT מגדיר Task Card.
2. Claude יוצר branch בשם `claude/task-<id>-<slug>` מה-commit שהוגדר.
3. Claude מממש, בודק ומבצע commit.
4. Claude מחזיר: branch, SHA, קבצים, בדיקות, חריגות.
5. ChatGPT משווה commits ובודק את ה-diff.
6. אם מאושר, נפתח PR או מתבצע cherry-pick לענף האינטגרציה.
7. מיזוג ל-main רק לאחר build תקין ובדיקה ידנית באתר preview.

## פורמט Task Card
```text
TASK-ID:
מטרה:
Base commit:
Branch target:
קבצים מותרים:
קבצים אסורים:
דרישות:
בדיקות חובה:
Definition of Done:
דיווח סיום:
```

## פורמט דיווח Claude
```text
TASK-ID:
Branch:
Commit SHA:
קבצים ששונו:
בדיקות: typecheck / test / build
תוצאה:
חריגות או סיכונים:
```

## שערי איכות
- TypeScript strict ללא שגיאות.
- Build מצליח.
- בדיקות יחידה עוברות.
- אין סודות תחת `VITE_`.
- אין שינוי ל-`base: './'` או ל-HashRouter.
- אין regression ב-RTL, dark mode או mobile.
- שינוי state persisted כולל version + migrate.
- שינוי במודל הדירוג כולל בדיקות מספריות.
- שינוי UI כולל empty/loading/error states.

## סדר הביצוע המאושר
1. התקנת Vitest ותשתית בדיקות.
2. בדיקות ל-scoring.ts ול-alerts.ts.
3. הגדרת semantics אחידה ל-currentPrice.
4. migrate ל-Zustand persist.
5. try/catch ומצבי שגיאה בחיפוש.
6. תיקוני P0/P1 נוספים.
7. iPhone/Safari/Safe Area.
8. PWA בסיסית.
9. רק לאחר בסיס יציב: backend, image upload, HEIC, OCR, Vision ו-AI.

## כלל הכרעה
במחלוקת בין מהירות לאיכות: אין למזג שינוי שאינו ניתן לבדיקה או שחושף סיכון נתונים/אבטחה. ChatGPT מכריע בארכיטקטורה; Claude מכריע בפרטי מימוש מקומיים, כל עוד נשמר המפרט.
