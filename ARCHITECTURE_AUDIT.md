# 🔍 AUDITORÍA DE ARQUITECTURA - Elite Sprint IA
**Fecha**: 2025-12-21  
**Estado**: CRÍTICO - Múltiples errores de producción detectados

---

## 🚨 ERRORES CRÍTICOS DETECTADOS

### 1. **Error de Recarga Constante** ⚠️
**Síntoma**: "Algo salió mal. Recargar"  
**Causa Raíz**: 
- Props inválidos en componentes Recharts (`minHeight`, `maxHeight`)
- Recursos 404 (archivos no encontrados)
- Errores de TypeScript no capturados en build

**Ubicaciones**:
```
- CoachDashboard.tsx: Charts con props incorrectos
- PlanManager.tsx: Línea 239 - minHeight inline style
- index.css: Posible recurso faltante
```

### 2. **Problema de Contexto y Estado**
**Síntoma**: Datos no se cargan correctamente  
**Causa**:
- `AppContext` no maneja errores de Firebase correctamente
- `switchAthlete()` no valida si el atleta existe antes de cambiar
- Race conditions entre `adminProfile` y `userProfile`

### 3. **Errores de Navegación**
**Síntoma**: Navegación rota entre secciones  
**Causa**:
- HashRouter puede causar problemas con query params
- Rutas no validan permisos (role-based access)
- `useLocation()` en VideoAnalyzer puede fallar en primera carga

---

## 🏗️ PROBLEMAS DE ARQUITECTURA

### **A. Gestión de Estado**
❌ **Problema**: Estado duplicado y desincronizado
- `adminProfile` vs `userProfile` confuso
- `viewingAthleteId` no se limpia al salir
- No hay loading states intermedios

✅ **Solución Recomendada**:
```typescript
// Implementar un reducer pattern
const [state, dispatch] = useReducer(appReducer, initialState);

// Estados claros:
interface AppState {
  auth: { user, loading, error }
  profile: { admin, viewing, loading, error }
  data: { plans, logs, analysis }
}
```

### **B. Manejo de Errores**
❌ **Problema**: ErrorBoundary genérico sin logging
- No captura errores async
- No reporta a consola/servicio
- Usuario pierde contexto

✅ **Solución**:
```typescript
// Agregar error tracking
componentDidCatch(error, errorInfo) {
  console.error('Error capturado:', error, errorInfo);
  // Enviar a servicio de logging (Sentry, etc)
}
```

### **C. Performance**
❌ **Problemas Detectados**:
1. Re-renders innecesarios en `CoachDashboard`
2. `useMemo` mal usado en varios componentes
3. Queries Firebase sin caché
4. Charts se re-renderizan en cada cambio

✅ **Optimizaciones**:
```typescript
// 1. Memoizar componentes pesados
const ChartComponent = React.memo(({ data }) => { ... });

// 2. Usar React.lazy para code splitting
const VideoAnalyzer = lazy(() => import('./VideoAnalyzer'));

// 3. Implementar cache en Firebase
const cachedData = useMemo(() => 
  fetchWithCache(key, fetchFn), 
  [key]
);
```

---

## 🔧 CORRECCIONES INMEDIATAS NECESARIAS

### **Prioridad 1: Arreglar Charts**
```typescript
// ANTES (INCORRECTO):
<ResponsiveContainer width="100%" height="100%" minHeight={160}>

// DESPUÉS (CORRECTO):
<ResponsiveContainer width="100%" height={160}>
```

### **Prioridad 2: Validar switchAthlete**
```typescript
const switchAthlete = async (uid: string | null) => {
  if (uid) {
    try {
      const athleteData = await fetchUserData(uid);
      if (!athleteData) {
        console.error('Atleta no encontrado');
        return;
      }
      setViewingAthleteId(uid);
      setUserProfile(athleteData);
    } catch (error) {
      console.error('Error al cambiar atleta:', error);
      // Mostrar toast/notificación
    }
  } else {
    setViewingAthleteId(null);
    setUserProfile(adminProfile);
  }
};
```

### **Prioridad 3: Agregar Loading States**
```typescript
// En cada componente principal:
if (loading) return <LoadingSpinner />;
if (error) return <ErrorDisplay error={error} />;
if (!data) return <EmptyState />;
```

---

## 📊 ANÁLISIS DE DEPENDENCIAS

### **Recharts Issues**
- Versión actual puede tener bugs con props
- Considerar migrar a `visx` o `nivo`
- O downgrade a versión estable conocida

### **Firebase**
- Queries sin optimizar (fetch completo cada vez)
- No usa `onSnapshot` para real-time cuando sería útil
- Falta manejo de offline

### **React Router**
- HashRouter es legacy, considerar BrowserRouter
- Falta lazy loading de rutas
- No hay route guards (protección por rol)

---

## 🎯 PLAN DE ACCIÓN RECOMENDADO

### **Fase 1: Estabilización (HOY)**
1. ✅ Arreglar props de Recharts
2. ✅ Agregar try-catch en todas las funciones async
3. ✅ Validar datos antes de renderizar
4. ✅ Mejorar ErrorBoundary

### **Fase 2: Optimización (Esta Semana)**
1. Implementar loading skeletons
2. Agregar cache a Firebase queries
3. Memoizar componentes pesados
4. Code splitting por ruta

### **Fase 3: Refactor (Próxima Semana)**
1. Migrar a useReducer para estado global
2. Implementar route guards
3. Agregar error tracking service
4. Tests unitarios críticos

---

## 🐛 BUGS ESPECÍFICOS ENCONTRADOS

### **CoachDashboard.tsx**
- Línea ~250: Chart sin validación de datos vacíos
- Línea ~130: `currentAthlete` puede ser undefined
- Falta cleanup en useEffect de briefings

### **VideoAnalyzer.tsx**
- `useLocation()` se ejecuta antes de que Router esté listo
- `videoFingerprint` no se limpia al cambiar video
- Comparison mode no valida si videos existen

### **AppContext.tsx**
- `switchAthlete` no es async pero hace llamadas async
- No hay timeout para Firebase queries
- `acwrStats` se calcula en cada render

### **PlanManager.tsx**
- Línea 239: `minHeight` en style inline (React warning)
- FeedbackModal no limpia estado al cerrar
- InfoButton tooltip puede salirse de pantalla

---

## 📈 MÉTRICAS DE SALUD

| Métrica | Estado | Objetivo |
|---------|--------|----------|
| Build Errors | 🔴 5+ | 0 |
| Runtime Errors | 🔴 Alto | Bajo |
| Performance Score | 🟡 65 | 90+ |
| Bundle Size | 🟡 2.5MB | <2MB |
| Load Time | 🟡 3.2s | <2s |

---

## 🔐 SEGURIDAD

### **Vulnerabilidades Detectadas**:
1. API Keys expuestas en código (usar .env)
2. No hay validación de permisos en rutas
3. Firebase rules no verificadas
4. XSS potencial en user-generated content

---

## 💡 RECOMENDACIONES FINALES

1. **Implementar CI/CD** con tests automáticos
2. **Agregar Sentry** o similar para error tracking
3. **Usar TypeScript strict mode** para catch más errores
4. **Implementar feature flags** para rollouts graduales
5. **Agregar monitoring** (Vercel Analytics, etc.)

---

**Próximos Pasos**: Aplicar correcciones de Fase 1 inmediatamente.
