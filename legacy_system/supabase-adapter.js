// supabase-adapter.js
// Adaptador para migrar de localStorage a Supabase

const db = {
    async getCasos() {
        const { data, error } = await window.supabaseClient
            .from('casos')
            .select('*')
            .order('id', { ascending: false });
        if (error) throw error;
        return data;
    },

    async getCaso(nSiniestro) {
        const { data, error } = await window.supabaseClient
            .from('casos')
            .select('*')
            .eq('n_siniestro', String(nSiniestro))
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async upsertCaso(caso) {
        const dbCaso = {
            cia: caso.cia,
            analista: caso.analista,
            asegurado: caso.asegurado,
            dni: caso.dni,
            n_siniestro: String(caso.nSiniestro || caso.n_siniestro),
            poliza: caso.poliza,
            ramo: caso.ramo,
            causa: caso.causa,
            cobertura: caso.cobertura,
            calle_riesgo: caso.calleRiesgo || caso.calle_riesgo,
            localidad_r: caso.localidadR || caso.localidad_r,
            provincia_r: caso.provinciaR || caso.provincia_r,
            mail: caso.mail,
            telefono: caso.telefono,
            estado: caso.estado,
            entrevista: caso.entrevista,
            comentarios_compania: caso.comentariosCompania || caso.comentarios_compania,
            checklist: caso.checklist || {},
            tabla_daños: caso.tablaDanos || caso.tabla_daños || [],
            documentos: caso.documentos || [],
            informe: caso.informe || {}
        };

        const { data, error } = await window.supabaseClient
            .from('casos')
            .upsert(dbCaso, { onConflict: 'n_siniestro' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteCaso(nSiniestro) {
        const { error } = await window.supabaseClient
            .from('casos')
            .delete()
            .eq('n_siniestro', String(nSiniestro));
        if (error) throw error;
    },

    async getComentarios(nSiniestro) {
        const { data, error } = await window.supabaseClient
            .from('comentarios')
            .select('*')
            .eq('n_siniestro', String(nSiniestro))
            .order('creado_en', { ascending: false });
        if (error) throw error;
        return data;
    },

    async addComentario(nSiniestro, texto, nombreAutor) {
        const { data, error } = await window.supabaseClient
            .from('comentarios')
            .insert({
                n_siniestro: String(nSiniestro),
                texto: texto,
                nombre_autor: nombreAutor,
                creado_por: (await window.supabaseClient.auth.getUser()).data.user?.id
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getTareas(nSiniestro) {
        let query = window.supabaseClient.from('tareas').select(`
            *,
            casos:n_siniestro (
                asegurado
            )
        `);
        if (nSiniestro) query = query.eq('n_siniestro', String(nSiniestro));
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async upsertTarea(tarea) {
        const dbTarea = {
            id: tarea.id,
            n_siniestro: String(tarea.nSiniestro || tarea.n_siniestro),
            texto: tarea.texto,
            fecha: tarea.fecha,
            hora: tarea.hora,
            hecha: tarea.hecha,
            creada_por: (await window.supabaseClient.auth.getUser()).data.user?.id
        };
        if (!dbTarea.id) delete dbTarea.id;

        const { data, error } = await window.supabaseClient
            .from('tareas')
            .upsert(dbTarea)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteTarea(id) {
        const { error } = await window.supabaseClient
            .from('tareas')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getFacturas() {
        const { data, error } = await window.supabaseClient
            .from('facturas')
            .select(`
                *,
                casos:n_siniestro (
                    asegurado,
                    analista,
                    cia
                )
            `)
            .order('id', { ascending: false });
        if (error) throw error;
        return data;
    },

    async getFactura(nSiniestro) {
        const { data, error } = await window.supabaseClient
            .from('facturas')
            .select('*')
            .eq('n_siniestro', String(nSiniestro))
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async upsertFactura(factura) {
        const dbFactura = {
            n_siniestro: String(factura.nSiniestro || factura.n_siniestro),
            punto_venta: factura.puntoVenta || factura.punto_venta,
            numero_factura: factura.numeroFactura || factura.numero_factura,
            fecha_emision: factura.fechaEmision || factura.fecha_emision,
            cae: factura.cae,
            estado_pago: factura.estadoPago || factura.estado_pago,
            fecha_cobro: factura.fechaCobro || factura.fecha_cobro,
            orden_pago: factura.ordenPago || factura.orden_pago,
            total_neto: factura.totalNeto || factura.total_neto,
            total_iva: factura.totalIva || factura.total_iva,
            total_general: factura.totalGeneral || factura.total_general,
            items: factura.items || []
        };

        const { data, error } = await window.supabaseClient
            .from('facturas')
            .upsert(dbFactura, { onConflict: 'n_siniestro' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async loadAllData(nSiniestro) {
        if (!nSiniestro) return null;
        const [caso, comentarios, tareas, factura] = await Promise.all([
            this.getCaso(nSiniestro),
            this.getComentarios(nSiniestro),
            this.getTareas(nSiniestro),
            this.getFactura(nSiniestro)
        ]);
        return { caso, comentarios, tareas, factura };
    },

    // --- MÉTODOS PARA CATÁLOGOS (Administración) ---
    async getCatalogo(tabla) {
        const { data, error } = await window.supabaseClient
            .from(tabla)
            .select('*')
            .order('nombre', { ascending: true });
        if (error) throw error;
        return data;
    },

    async upsertCatalogo(tabla, item) {
        const payload = { ...item };
        // Limpieza de campos que Supabase maneja automáticamente si es insert
        if (payload.updatedAt) {
            payload.actualizado_at = payload.updatedAt;
            delete payload.updatedAt;
        }
        if (payload.createdAt) {
            payload.creado_at = payload.createdAt;
            delete payload.createdAt;
        }

        const { data, error } = await window.supabaseClient
            .from(tabla)
            .upsert(payload)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteCatalogo(tabla, id) {
        const { error } = await window.supabaseClient
            .from(tabla)
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

window.db = db;
