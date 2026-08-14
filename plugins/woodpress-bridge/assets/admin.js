jQuery(document).ready(function ($) {
    // 1. GESTION DU FICHIER EN DROPZONE
    $('#azf-file-input').on('change', function () {
        if (this.files && this.files[0]) {
            var file = this.files[0];
            $('#selected-file-name').text(file.name + ' (' + (file.size / (1024 * 1024)).toFixed(2) + ' Mo)');
            $('#btn-import-azf').prop('disabled', false);
        }
    });

    // 2. EXPORTATION .AZF
    $('#btn-export-azf').on('click', function () {
        var $btn = $(this);
        $btn.prop('disabled', true).text('⏳ Génération du paquet .AZF...');
        $('#export-progress').show();
        $('#export-fill').css('width', '35%');
        $('#export-status-text').text('Dump de la base de données SQL et compression wp-content...');

        var data = {
            action: 'woodpress_export_azf',
            nonce: woodpress_bridge.nonce,
            include_uploads: $('#wp_include_uploads').is(':checked'),
            include_plugins: $('#wp_include_plugins').is(':checked'),
            include_themes: $('#wp_include_themes').is(':checked')
        };

        $.post(woodpress_bridge.ajax_url, data, function (res) {
            if (res.success) {
                $('#export-fill').css('width', '100%');
                $('#export-status-text').text('✅ Exportation réussie ! Téléchargement immédiat...');

                // Déclencher le téléchargement
                window.location.href = res.data.download_url;

                setTimeout(function () {
                    $btn.prop('disabled', false).text('🚀 Générer & Télécharger le Paquet .AZF');
                }, 4000);
            } else {
                alert('Erreur lors de l\'exportation : ' + (res.data ? res.data.message : 'Erreur inconnue'));
                $btn.prop('disabled', false).text('🚀 Générer & Télécharger le Paquet .AZF');
                $('#export-progress').hide();
            }
        }).fail(function () {
            alert('Erreur réseau ou délai d\'attente dépassé.');
            $btn.prop('disabled', false).text('🚀 Générer & Télécharger le Paquet .AZF');
            $('#export-progress').hide();
        });
    });

    // 3. IMPORTATION .AZF
    $('#btn-import-azf').on('click', function () {
        var fileInput = document.getElementById('azf-file-input');
        if (!fileInput.files || !fileInput.files[0]) {
            alert('Veuillez sélectionner un fichier .AZF');
            return;
        }

        if (!confirm('ATTENTION : L\'importation va écraser la base de données actuelle et mettre à jour les fichiers wp-content. Souhaitez-vous continuer ?')) {
            return;
        }

        var $btn = $(this);
        $btn.prop('disabled', true).text('⏳ Importation et Restauration...');
        $('#import-progress').show();
        $('#import-fill').css('width', '40%');
        $('#import-status-text').text('Téléversement et décompression du paquet .AZF...');

        var formData = new FormData();
        formData.append('action', 'woodpress_import_azf');
        formData.append('nonce', woodpress_bridge.nonce);
        formData.append('azf_file', fileInput.files[0]);

        $.ajax({
            url: woodpress_bridge.ajax_url,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                if (res.success) {
                    $('#import-fill').css('width', '100%');
                    $('#import-status-text').text('✅ Site restauré avec succès ! Rechargement...');
                    setTimeout(function () {
                        location.reload();
                    }, 2000);
                } else {
                    alert('Erreur lors de l\'importation : ' + (res.data ? res.data.message : 'Erreur'));
                    $btn.prop('disabled', false).text('📥 Lancer l\'Importation du Site');
                    $('#import-progress').hide();
                }
            },
            error: function () {
                alert('Erreur réseau lors de l\'envoi du fichier.');
                $btn.prop('disabled', false).text('📥 Lancer l\'Importation du Site');
                $('#import-progress').hide();
            }
        });
    });
});
